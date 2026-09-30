import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { userSetupsKey } from "../setups/queries";
import { testSetup } from "../setups/testFixtures";
import {
  alice,
  charlie,
  bob,
  emptyList,
  friendshipUrl,
  item,
  relationship,
  renderFriendsRoute,
} from "./testUtils";
const publicSetup = {
  ...testSetup,
  visibility: "public" as const,
  title: "Public build",
};
it.each([200, 404, 409])(
  "accept %s refreshes only the other participant's visible list",
  async (status) => {
    let changed = false,
      calls = 0;
    server.use(
      http.get(friendshipUrl, () =>
        HttpResponse.json({
          ...emptyList(),
          incoming: changed ? [] : [item(alice, charlie.id)],
        }),
      ),
      http.post(`${friendshipUrl}/${charlie.id}/accept`, () => {
        calls++;
        changed = true;
        return status === 200
          ? HttpResponse.json(relationship("accepted", alice))
          : HttpResponse.json({ error: "Stale" }, { status });
      }),
    );
    const { client } = renderFriendsRoute("/friends");
    client.setQueryData(userSetupsKey(alice.id), [publicSetup]);
    client.setQueryData(userSetupsKey(bob.id), []);
    await screen.findByText(alice.nickname);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByText("No incoming requests.");
    if (status === 200)
      expect(client.getQueryState(userSetupsKey(alice.id))?.isInvalidated).toBe(
        true,
      );
    else expect(client.getQueryData(userSetupsKey(alice.id))).toBeUndefined();
    expect(client.getQueryData(userSetupsKey(bob.id))).toEqual([]);
    expect(client.getQueryState(userSetupsKey(bob.id))?.isInvalidated).toBe(
      false,
    );
    expect(calls).toBe(1);
  },
);
it.each([204, 404])(
  "accepted DELETE %s purges only the other user's list",
  async (status) => {
    let changed = false;
    server.use(
      http.get(friendshipUrl, () =>
        HttpResponse.json({
          ...emptyList(),
          accepted: changed ? [] : [item(alice, charlie.id)],
        }),
      ),
      http.delete(`${friendshipUrl}/${charlie.id}`, () => {
        changed = true;
        return status === 204
          ? new HttpResponse(null, { status })
          : HttpResponse.json({ error: "Stale" }, { status });
      }),
    );
    const { client } = renderFriendsRoute("/friends");
    client.setQueryData(userSetupsKey(alice.id), [publicSetup, testSetup]);
    client.setQueryData(userSetupsKey(bob.id), [publicSetup]);
    await screen.findByText(alice.nickname);
    const events = userEvent.setup();
    await events.click(screen.getByRole("button", { name: "Remove friend" }));
    await events.click(screen.getByRole("button", { name: "Remove" }));
    await screen.findByText("No friends yet.");
    expect(client.getQueryData(userSetupsKey(alice.id))).toBeUndefined();
    expect(client.getQueryData(userSetupsKey(bob.id))).toEqual([publicSetup]);
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
  },
);
it.each(["incoming", "outgoing"] as const)(
  "pending %s deletion leaves visible-user-list cache intact",
  async (bucket) => {
    let changed = false;
    server.use(
      http.get(friendshipUrl, () => {
        const list = emptyList();
        if (!changed) list[bucket] = [item(alice)];
        return HttpResponse.json(list);
      }),
      http.delete(`${friendshipUrl}/${alice.id}`, () => {
        changed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { client } = renderFriendsRoute("/friends");
    client.setQueryData(userSetupsKey(alice.id), [publicSetup]);
    await screen.findByText(alice.nickname);
    await userEvent.setup().click(
      screen.getByRole("button", {
        name: bucket === "incoming" ? "Reject" : "Cancel request",
      }),
    );
    await screen.findByText(
      bucket === "incoming" ? "No incoming requests." : "No outgoing requests.",
    );
    expect(client.getQueryData(userSetupsKey(alice.id))).toEqual([publicSetup]);
    expect(client.getQueryState(userSetupsKey(alice.id))?.isInvalidated).toBe(
      false,
    );
  },
);
it("removal cancels in-flight user list and late friends-only data cannot return; next profile visit fetches again", async () => {
  let removed = false,
    canceled = false;
  let finish!: (value: components["schemas"]["Setup"][]) => void;
  server.use(
    http.get(friendshipUrl, () =>
      HttpResponse.json({
        ...emptyList(),
        accepted: removed ? [] : [item(alice)],
      }),
    ),
    http.delete(`${friendshipUrl}/${alice.id}`, () => {
      removed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { client, router } = renderFriendsRoute("/friends");
  client.setQueryData(userSetupsKey(alice.id), [publicSetup, testSetup]);
  const oldRequest = client
    .fetchQuery({
      queryKey: userSetupsKey(alice.id),
      queryFn: ({ signal }) =>
        new Promise<components["schemas"]["Setup"][]>((resolve) => {
          finish = resolve;
          signal.addEventListener("abort", () => {
            canceled = true;
          });
        }),
    })
    .catch(() => undefined);
  await screen.findByText(alice.nickname);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Remove friend" }));
  await events.click(screen.getByRole("button", { name: "Remove" }));
  await screen.findByText("No friends yet.");
  expect(canceled).toBe(true);
  expect(client.getQueryData(userSetupsKey(alice.id))).toBeUndefined();
  await act(async () => {
    finish([publicSetup, testSetup]);
    await oldRequest;
  });
  expect(client.getQueryData(userSetupsKey(alice.id))).toBeUndefined();
  let lists = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/users/${alice.id}`, () =>
      HttpResponse.json(alice),
    ),
    http.get(`${apiUrl}/api/v1/users/${alice.id}/setups`, () => {
      lists++;
      return HttpResponse.json([publicSetup]);
    }),
  );
  await act(async () => {
    await router.navigate(`/users/${alice.id}`);
  });
  await screen.findByText("Public build");
  expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
  expect(lists).toBe(1);
});
