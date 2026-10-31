import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { routes } from "../../app/router";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { browserNavigation, googleLoginUrl } from "../auth/navigation";
import { rememberCloneTarget } from "./cloneIntent";

const source = {
  ...testSetup,
  visibility: "public" as const,
  moderation_status: "approved" as const,
};
const copyId = "22222222-2222-4222-8222-222222222222";
const copy = {
  ...source,
  id: copyId,
  title: source.title + " (Copy)",
  visibility: "private" as const,
  moderation_status: "pending" as const,
  cover_photo: null,
};
let signedIn = true;
let writes: string[];
beforeEach(() => {
  signedIn = true;
  writes = [];
  sessionStorage.clear();
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      signedIn
        ? HttpResponse.json(testUser)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${source.id}`, () =>
      HttpResponse.json(source),
    ),
    http.get(`${apiUrl}/api/v1/setups/${copyId}`, () =>
      HttpResponse.json(copy),
    ),
    http.get(`${apiUrl}/api/v1/setups/:id/photos`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
      HttpResponse.json(testUser),
    ),
    http.get(`${apiUrl}/api/v1/setups/search`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.post(
      `${apiUrl}/api/v1/setups/${source.id}/clone`,
      async ({ request }) => {
        const body = (await request.json()) as { request_id: string };
        expect(Object.keys(body)).toEqual(["request_id"]);
        expect(request.credentials).toBe("include");
        writes.push(body.request_id);
        return HttpResponse.json(copy, { status: 201 });
      },
    ),
  );
});
function show(path = `/setups/${source.id}`) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}
it.each([testUser.id, "33333333-3333-4333-8333-333333333333"])(
  "confirms a public clone for owner/non-owner %s and navigates to a private no-photo copy",
  async (owner_id) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${source.id}`, () =>
        HttpResponse.json({ ...source, owner_id }),
      ),
      http.get(`${apiUrl}/api/v1/users/${owner_id}`, () =>
        HttpResponse.json({ ...testUser, id: owner_id }),
      ),
    );
    const { router } = show();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Clone setup" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Clone setup?" });
    expect(writes).toHaveLength(0);
    expect(
      within(dialog).getByText(/Photos are not copied/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(writes).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Clone setup" }));
    await user.dblClick(
      within(dialog).getByRole("button", { name: "Create private copy" }),
    );
    await screen.findByRole("heading", { name: copy.title });
    expect(router.state.location.pathname).toBe(`/setups/${copyId}`);
    expect(writes).toHaveLength(1);
    expect(
      screen.getByText("Private copy created. Photos were not copied."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clone setup" }),
    ).not.toBeInTheDocument();
    await screen.findByText("No photos yet.");
  },
);
it.each([
  { visibility: "private", moderation_status: "approved" },
  { visibility: "friends", moderation_status: "approved" },
  { visibility: "public", moderation_status: "pending" },
  { visibility: "public", moderation_status: "rejected" },
])("hides Clone for $visibility/$moderation_status", async (state) => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${source.id}`, () =>
      HttpResponse.json({ ...source, ...state }),
    ),
  );
  show();
  await screen.findByRole("heading", { name: source.title });
  expect(
    screen.queryByRole("button", { name: "Clone setup" }),
  ).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});
it("guest click preserves the target through sign-in and requires fresh confirmation", async () => {
  signedIn = false;
  const navigate = vi
    .spyOn(browserNavigation, "assign")
    .mockImplementation(() => undefined);
  const view = show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Clone setup" }));
  expect(navigate).toHaveBeenCalledWith(googleLoginUrl);
  expect(writes).toHaveLength(0);
  // Simulate the backend's fixed APP_URL callback landing and resolved new session.
  signedIn = true;
  await act(async () => {
    await view.router.navigate("/");
    await view.client.invalidateQueries({ queryKey: ["auth", "me"] });
  });
  await screen.findByRole("dialog", { name: "Clone setup?" });
  expect(writes).toHaveLength(0);
  expect(view.router.state.location.pathname).toBe(`/setups/${source.id}`);
  expect(sessionStorage.getItem("rc-clone-intent")).toBeNull();
  navigate.mockRestore();
});
it.each([401, 403, 404, 409])(
  "handles clone failure %s without navigation or retries",
  async (status) => {
    let attempts = 0;
    server.use(
      http.post(`${apiUrl}/api/v1/setups/${source.id}/clone`, () => {
        attempts++;
        return new HttpResponse(null, { status });
      }),
    );
    const { router } = show();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Clone setup" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create private copy" }),
    );
    if (status !== 401) await screen.findByRole("alert");
    else await screen.findByRole("button", { name: "Sign in" });
    expect(attempts).toBe(1);
    expect(router.state.location.pathname).toBe(`/setups/${source.id}`);
  },
);
it("reuses the same request UUID after an ambiguous network/server failure", async () => {
  let fail = true;
  const requests: string[] = [];
  server.use(
    http.post(
      `${apiUrl}/api/v1/setups/${source.id}/clone`,
      async ({ request }) => {
        requests.push(
          ((await request.json()) as { request_id: string }).request_id,
        );
        return fail
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(copy, { status: 201 });
      },
    ),
  );
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Clone setup" }));
  await user.click(screen.getByRole("button", { name: "Create private copy" }));
  await screen.findByRole("alert");
  fail = false;
  await user.click(screen.getByRole("button", { name: "Create private copy" }));
  await screen.findByRole("heading", { name: copy.title });
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
});
it("does not expose a source link when the currently requested source is unavailable", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${copyId}`, () =>
      HttpResponse.json({ ...copy, source_setup_id: source.id }),
    ),
    http.get(
      `${apiUrl}/api/v1/setups/${source.id}`,
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
  const { client } = show(`/setups/${copyId}`);
  await screen.findByRole("heading", { name: copy.title });
  await waitFor(() =>
    expect(
      client.getQueryState(["setups", "detail", copyId, "source", source.id])
        ?.status,
    ).toBe("error"),
  );
  expect(
    screen.queryByRole("link", { name: "Based on original setup" }),
  ).not.toBeInTheDocument();
});
it("never creates a clone merely from a stored continuation", async () => {
  rememberCloneTarget(source.id);
  show("/");
  await screen.findByRole("dialog", { name: "Clone setup?" });
  expect(writes).toHaveLength(0);
});

it("discards a late clone response after the session changes", async () => {
  let finish!: () => void;
  server.use(
    http.post(`${apiUrl}/api/v1/setups/${source.id}/clone`, async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return HttpResponse.json(copy, { status: 201 });
    }),
  );
  const { client, router } = show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Clone setup" }));
  await user.click(screen.getByRole("button", { name: "Create private copy" }));
  await screen.findByRole("button", { name: "Cloning…" });
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  await act(async () => {
    signedIn = false;
    client.setQueryData(["auth", "me"], null);
    finish();
  });
  await waitFor(() =>
    expect(
      client
        .getMutationCache()
        .getAll()
        .every((m) => m.state.status !== "pending"),
    ).toBe(true),
  );
  expect(router.state.location.pathname).toBe(`/setups/${source.id}`);
  expect(client.getQueryData(["setups", "detail", copyId])).toBeUndefined();
  expect(
    screen.queryByRole("heading", { name: copy.title }),
  ).not.toBeInTheDocument();
});

it("shows only a currently approved public source attribution", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${copyId}`, () =>
      HttpResponse.json({ ...copy, source_setup_id: source.id }),
    ),
  );
  show(`/setups/${copyId}`);
  expect(
    await screen.findByRole("link", { name: "Based on original setup" }),
  ).toHaveAttribute("href", `/setups/${source.id}`);
});
