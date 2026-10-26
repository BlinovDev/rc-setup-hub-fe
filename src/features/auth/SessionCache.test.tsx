import { act, render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup } from "../setups/testFixtures";
import {
  detailKey,
  mineKey,
  usePatchSetup,
  withSession,
} from "../setups/queries";
import { SetupError } from "../setups/api";
import { AuthGate } from "./AuthGate";
import { currentUserKey } from "./queries";

const user = {
  id: testSetup.owner_id,
  nickname: "First driver",
  email: "a@example.test",
  avatar_url: null,
  created_at: testSetup.created_at,
};
const other = {
  ...user,
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "Second driver",
};
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
function show(children?: () => React.ReactNode) {
  const client = new QueryClient();
  clients.push(client);
  client.setQueryData(currentUserKey, user);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthGate>{() => children?.()}</AuthGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it.each([null, other])(
  "purges protected caches on viewer transition to %s and retains catalog/unrelated data",
  async (next) => {
    const client = show();
    const keys = [
      mineKey,
      detailKey(testSetup.id),
      ["setups", "detail", testSetup.id, "media", user.id],
      ["friendships"],
      ["users", "public", user.id],
      ["users", "search", "driver"],
    ];
    keys.forEach((key) => client.setQueryData(key, { private: true }));
    client.setQueryData(["chassis", "brands"], ["catalog"]);
    client.setQueryData(["unrelated"], "keep");
    act(() => {
      client.setQueryData(currentUserKey, next);
    });
    await waitFor(() =>
      keys.forEach((key) => expect(client.getQueryData(key)).toBeUndefined()),
    );
    expect(client.getQueryData(["chassis", "brands"])).toEqual(["catalog"]);
    expect(client.getQueryData(["unrelated"])).toBe("keep");
  },
);
it("never renders the first viewer's cached result under the second identity", async () => {
  const seen: string[] = [];
  let current = user;
  function Protected() {
    const result = useQuery({
      queryKey: mineKey,
      queryFn: async () => current.nickname,
      staleTime: Infinity,
    });
    if (result.data) seen.push(`${current.nickname}:${result.data}`);
    return <p>{result.data}</p>;
  }
  const client = show(() => <Protected />);
  await screen.findByText("First driver", { selector: "p" });
  current = other;
  act(() => {
    client.setQueryData(currentUserKey, other);
  });
  await waitFor(() => expect(seen).toContain("Second driver:Second driver"));
  expect(seen).not.toContain("Second driver:First driver");
});
it("cancels an old protected read before a late response can repopulate its cache", async () => {
  const client = show();
  let finish!: (value: string) => void;
  const request = client.fetchQuery({
    queryKey: mineKey,
    queryFn: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  const outcome = request.catch(() => "cancelled");
  act(() => {
    client.setQueryData(currentUserKey, null);
  });
  finish("private first-viewer data");
  expect(await outcome).toBe("cancelled");
  expect(client.getQueryData(mineKey)).toBeUndefined();
});
it("does not let a late setup mutation restore protected data after logout", async () => {
  let finish!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return HttpResponse.json(testSetup);
    }),
  );
  let save!: () => Promise<unknown>;
  function Editor() {
    const patch = usePatchSetup(testSetup.id);
    save = () => patch.mutateAsync({ title: "Updated" });
    return null;
  }
  const client = show(() => <Editor />);
  let outcome!: Promise<unknown>;
  act(() => {
    outcome = save().catch((error) => error);
  });
  await pending;
  act(() => {
    client.setQueryData(currentUserKey, null);
  });
  finish();
  await act(async () => {
    await outcome;
  });
  expect(client.getQueryData(detailKey(testSetup.id))).toBeUndefined();
  expect(client.getQueryData(currentUserKey)).toBeNull();
});
it("ignores an old request's 401 after another viewer signs in", async () => {
  const client = show();
  let fail!: (error: Error) => void;
  const outcome = withSession(
    client,
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  ).catch((error) => error);
  act(() => {
    client.setQueryData(currentUserKey, other);
  });
  fail(new SetupError(401));
  await outcome;
  expect(client.getQueryData(currentUserKey)).toEqual(other);
});

it("rejects old completions even after signing back into the same account", async () => {
  const client = show();
  let finish!: (value: string) => void;
  const outcome = withSession(
    client,
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  ).catch((error) => error);
  act(() => {
    client.setQueryData(currentUserKey, null);
    client.setQueryData(currentUserKey, user);
  });
  finish("old response");
  expect(await outcome).toBeInstanceOf(Error);
  expect(client.getQueryData(currentUserKey)).toEqual(user);
});
