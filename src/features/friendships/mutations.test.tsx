import { fireEvent, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../../test/server";
import { detailKey, mineKey } from "../setups/queries";
import { testSetup, testUser } from "../setups/testFixtures";
import { currentUserKey } from "../auth/queries";
import { friendshipsKey } from "./queries";
import {
  alice,
  bob,
  charlie,
  driver,
  emptyList,
  friendshipUrl,
  fullList,
  item,
  mockList,
  relationship,
  renderFriendsRoute,
  searchUrl,
} from "./testUtils";
async function searchDriver() {
  const input = await screen.findByRole("textbox", { name: "Nickname" });
  fireEvent.change(input, { target: { value: "driver" } });
  await userEvent.setup().click(screen.getByRole("button", { name: "Search" }));
  return (
    await within(
      screen.getByRole("region", { name: "Find people" }),
    ).findByText(driver.nickname)
  ).closest("li")!;
}
function mockDriverSearch() {
  server.use(http.get(searchUrl, () => HttpResponse.json([driver])));
}
function seedUnrelated(
  client: ReturnType<typeof renderFriendsRoute>["client"],
) {
  client.setQueryData(mineKey, [testSetup]);
  client.setQueryData(["setups", "search", { q: "public" }], "search cache");
  client.setQueryData(["chassis", "brands"], "catalog");
  client.setQueryData(["unrelated"], "keep");
}
function assertUnrelated(
  client: ReturnType<typeof renderFriendsRoute>["client"],
) {
  expect(client.getQueryData(mineKey)).toEqual([testSetup]);
  expect(client.getQueryData(["unrelated"])).toBe("keep");
  for (const key of [
    mineKey,
    ["setups", "search", { q: "public" }],
    ["chassis", "brands"],
    currentUserKey,
  ])
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
}
it("sends the generated request body with credentials, disables duplicates, and reflects refreshed outgoing state", async () => {
  let sent = false,
    lists = 0,
    posts = 0;
  server.use(
    http.get(friendshipUrl, () => {
      lists++;
      return HttpResponse.json({
        ...emptyList(),
        outgoing: sent ? [item(driver)] : [],
      });
    }),
    http.post(friendshipUrl, async ({ request }) => {
      posts++;
      expect(request.credentials).toBe("include");
      expect(await request.json()).toEqual({ user_id: driver.id });
      await delay(80);
      sent = true;
      return HttpResponse.json(relationship("pending"), { status: 201 });
    }),
  );
  mockDriverSearch();
  const { client } = renderFriendsRoute("/friends");
  seedUnrelated(client);
  client.setQueryData(detailKey(testSetup.id), testSetup);
  const row = await searchDriver();
  await userEvent
    .setup()
    .click(within(row).getByRole("button", { name: "Add friend" }));
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await screen.findByText("Request sent");
  expect(
    screen.queryByRole("button", { name: "Add friend" }),
  ).not.toBeInTheDocument();
  expect(lists).toBe(2);
  expect(posts).toBe(1);
  expect(client.getQueryState(detailKey(testSetup.id))?.isInvalidated).toBe(
    false,
  );
  assertUnrelated(client);
});
it.each(["incoming", "outgoing", "accepted"] as const)(
  "send 409 refetches raced %s state without retrying POST",
  async (bucket) => {
    let conflict = false,
      posts = 0,
      lists = 0;
    server.use(
      http.get(friendshipUrl, () => {
        lists++;
        const list = emptyList();
        if (conflict) list[bucket] = [item(driver)];
        return HttpResponse.json(list);
      }),
      http.post(friendshipUrl, () => {
        posts++;
        conflict = true;
        return HttpResponse.json({ error: "Secret" }, { status: 409 });
      }),
    );
    mockDriverSearch();
    renderFriendsRoute("/friends");
    const row = await searchDriver();
    await userEvent
      .setup()
      .click(within(row).getByRole("button", { name: "Add friend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A relationship with this user already exists",
    );
    await within(
      screen.getByRole("region", { name: "Find people" }),
    ).findByText(
      bucket === "incoming"
        ? "Incoming request"
        : bucket === "outgoing"
          ? "Request sent"
          : "Friends",
      { exact: true },
    );
    expect(posts).toBe(1);
    expect(lists).toBe(2);
    expect(
      screen.queryByRole("button", { name: "Add friend" }),
    ).not.toBeInTheDocument();
  },
);
it("accept posts no body, refreshes server buckets, and invalidates only setup detail access", async () => {
  let accepted = false,
    lists = 0;
  server.use(
    http.get(friendshipUrl, () => {
      lists++;
      return HttpResponse.json({
        ...emptyList(),
        incoming: accepted ? [] : [item(alice)],
        accepted: accepted ? [item(alice)] : [],
      });
    }),
    http.post(`${friendshipUrl}/${alice.id}/accept`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      expect(await request.text()).toBe("");
      await delay(80);
      accepted = true;
      return HttpResponse.json(relationship("accepted", alice));
    }),
  );
  const { client } = renderFriendsRoute("/friends");
  seedUnrelated(client);
  client.setQueryData(detailKey(testSetup.id), testSetup);
  await screen.findByText(alice.nickname);
  await userEvent.setup().click(screen.getByRole("button", { name: "Accept" }));
  expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  await screen.findByText("No incoming requests.");
  expect(
    within(screen.getByRole("region", { name: "Friends" })).getByText(
      alice.nickname,
    ),
  ).toBeInTheDocument();
  expect(lists).toBe(2);
  expect(client.getQueryState(detailKey(testSetup.id))?.isInvalidated).toBe(
    true,
  );
  assertUnrelated(client);
});
it.each([404, 409])(
  "stale accept %s keeps useful feedback even when refresh removes the row",
  async (status) => {
    let stale = false,
      lists = 0,
      accepts = 0;
    server.use(
      http.get(friendshipUrl, () => {
        lists++;
        return HttpResponse.json({
          ...emptyList(),
          incoming: stale ? [] : [item(alice)],
        });
      }),
      http.post(`${friendshipUrl}/${alice.id}/accept`, () => {
        accepts++;
        stale = true;
        return HttpResponse.json({ error: "Internal" }, { status });
      }),
    );
    renderFriendsRoute("/friends");
    await screen.findByText(alice.nickname);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 404
        ? "relationship is no longer available"
        : "relationship has changed",
    );
    await screen.findByText("No incoming requests.");
    expect(lists).toBe(2);
    expect(accepts).toBe(1);
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
  },
);
it.each(["incoming", "outgoing"] as const)(
  "deletes %s pending request, refetches, and preserves detail/unrelated caches",
  async (bucket) => {
    const user = bucket === "incoming" ? alice : bob;
    let removed = false,
      deletes = 0;
    server.use(
      http.get(friendshipUrl, () => {
        const list = emptyList();
        if (!removed) list[bucket] = [item(user)];
        return HttpResponse.json(list);
      }),
      http.delete(`${friendshipUrl}/${user.id}`, ({ request }) => {
        expect(request.credentials).toBe("include");
        deletes++;
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { client } = renderFriendsRoute("/friends");
    seedUnrelated(client);
    client.setQueryData(detailKey(testSetup.id), testSetup);
    await screen.findByText(user.nickname);
    await userEvent.setup().click(
      screen.getByRole("button", {
        name: bucket === "incoming" ? "Reject" : "Cancel request",
      }),
    );
    await screen.findByText(
      bucket === "incoming" ? "No incoming requests." : "No outgoing requests.",
    );
    expect(deletes).toBe(1);
    expect(client.getQueryData(detailKey(testSetup.id))).toEqual(testSetup);
    expect(client.getQueryState(detailKey(testSetup.id))?.isInvalidated).toBe(
      false,
    );
    assertUnrelated(client);
  },
);
it("removing accepted friend requires confirmation, removes stale detail, and refreshes search-derived state", async () => {
  let removed = false,
    deletes = 0;
  server.use(
    http.get(friendshipUrl, () =>
      HttpResponse.json({
        ...emptyList(),
        accepted: removed ? [] : [item(driver)],
      }),
    ),
    http.delete(`${friendshipUrl}/${driver.id}`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      deletes++;
      await delay(80);
      removed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  mockDriverSearch();
  const { client } = renderFriendsRoute("/friends");
  seedUnrelated(client);
  client.setQueryData(detailKey(testSetup.id), testSetup);
  await searchDriver();
  const section = within(screen.getByRole("region", { name: "Friends" }));
  const events = userEvent.setup();
  await events.click(section.getByRole("button", { name: "Remove friend" }));
  expect(deletes).toBe(0);
  await events.click(section.getByRole("button", { name: "Cancel" }));
  expect(deletes).toBe(0);
  await events.click(section.getByRole("button", { name: "Remove friend" }));
  await events.click(section.getByRole("button", { name: "Remove" }));
  expect(section.getByRole("button", { name: "Removing…" })).toBeDisabled();
  expect(
    within(screen.getByRole("region", { name: "Find people" })).getByRole(
      "button",
      { name: "Remove friend" },
    ),
  ).toBeDisabled();
  await screen.findByText("No friends yet.");
  expect(
    screen.getByRole("button", { name: "Add friend" }),
  ).toBeInTheDocument();
  expect(deletes).toBe(1);
  expect(client.getQueryData(detailKey(testSetup.id))).toBeUndefined();
  assertUnrelated(client);
});
it("remove cancels in-flight detail before removing it; a later visit rechecks backend availability", async () => {
  let removed = false,
    started = false,
    canceled = false;
  server.use(
    http.get(friendshipUrl, () =>
      HttpResponse.json({
        ...emptyList(),
        accepted: removed ? [] : [item(charlie)],
      }),
    ),
    http.delete(`${friendshipUrl}/${charlie.id}`, () => {
      removed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { client, router } = renderFriendsRoute("/friends");
  client.setQueryData(detailKey(testSetup.id), testSetup);
  const inflight = client
    .fetchQuery({
      queryKey: detailKey(testSetup.id),
      queryFn: ({ signal }) =>
        new Promise<never>((_, reject) => {
          started = true;
          signal.addEventListener("abort", () => {
            canceled = true;
            reject(new Error("Canceled"));
          });
        }),
    })
    .catch(() => undefined);
  await waitFor(() => expect(started).toBe(true));
  await screen.findByText(charlie.nickname);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Remove friend" }));
  await events.click(screen.getByRole("button", { name: "Remove" }));
  await screen.findByText("No friends yet.");
  await inflight;
  expect(canceled).toBe(true);
  expect(client.getQueryData(detailKey(testSetup.id))).toBeUndefined();
  server.use(
    http.get(
      `${new URL(friendshipUrl).origin}/api/v1/setups/${testSetup.id}`,
      () => HttpResponse.json({ error: "Unavailable" }, { status: 404 }),
    ),
  );
  await router.navigate(`/setups/${testSetup.id}`);
  await screen.findByText("Setup not found or unavailable.");
  expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
});
it("delete 404 refreshes stale accepted state and purges detail without claiming success", async () => {
  let stale = false,
    lists = 0;
  server.use(
    http.get(friendshipUrl, () => {
      lists++;
      return HttpResponse.json({
        ...emptyList(),
        accepted: stale ? [] : [item(charlie)],
      });
    }),
    http.delete(`${friendshipUrl}/${charlie.id}`, () => {
      stale = true;
      return HttpResponse.json({ error: "Secret" }, { status: 404 });
    }),
  );
  const { client } = renderFriendsRoute("/friends");
  client.setQueryData(detailKey(testSetup.id), testSetup);
  await screen.findByText(charlie.nickname);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Remove friend" }));
  await events.click(screen.getByRole("button", { name: "Remove" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "relationship is no longer available",
  );
  await screen.findByText("No friends yet.");
  expect(lists).toBe(2);
  expect(client.getQueryData(detailKey(testSetup.id))).toBeUndefined();
});
it.each(["send", "accept", "delete"] as const)(
  "%s 401 clears existing auth and removes friendship UI",
  async (action) => {
    mockList();
    mockDriverSearch();
    const response = () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 });
    server.use(
      action === "send"
        ? http.post(friendshipUrl, response)
        : action === "accept"
          ? http.post(`${friendshipUrl}/${alice.id}/accept`, response)
          : http.delete(`${friendshipUrl}/${bob.id}`, response),
    );
    renderFriendsRoute("/friends");
    await screen.findByText(alice.nickname);
    if (action === "send") {
      const row = await searchDriver();
      await userEvent
        .setup()
        .click(within(row).getByRole("button", { name: "Add friend" }));
    } else
      await userEvent.setup().click(
        screen.getByRole("button", {
          name: action === "accept" ? "Accept" : "Cancel request",
        }),
      );
    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(screen.queryByText(alice.nickname)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  },
);
it.each([400, 403, 404, 500, "network"])(
  "send %s uses safe errors, preserves auth, and allows deliberate retry",
  async (status) => {
    mockList(emptyList());
    mockDriverSearch();
    let posts = 0;
    server.use(
      http.post(friendshipUrl, () => {
        posts++;
        return status === "network"
          ? HttpResponse.error()
          : HttpResponse.json(
              { error: "Secret internal details" },
              { status: Number(status) },
            );
      }),
    );
    const { client } = renderFriendsRoute("/friends");
    const row = await searchDriver();
    const events = userEvent.setup();
    await events.click(within(row).getByRole("button", { name: "Add friend" }));
    await screen.findByRole("alert");
    expect(
      screen.queryByText("Secret internal details"),
    ).not.toBeInTheDocument();
    expect(client.getQueryData(currentUserKey)).toEqual(testUser);
    expect(posts).toBe(1);
    await events.click(within(row).getByRole("button", { name: "Add friend" }));
    await waitFor(() => expect(posts).toBe(2));
  },
);
it.each([400, 403, 500, "network"])(
  "accept %s leaves request and auth intact for retry",
  async (status) => {
    mockList();
    server.use(
      http.post(`${friendshipUrl}/${alice.id}/accept`, () =>
        status === "network"
          ? HttpResponse.error()
          : HttpResponse.json({ error: "Secret" }, { status: Number(status) }),
      ),
    );
    const { client } = renderFriendsRoute("/friends");
    await screen.findByText(alice.nickname);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Accept" }));
    await screen.findByRole("alert");
    expect(screen.getByText(alice.nickname)).toBeInTheDocument();
    expect(client.getQueryData(currentUserKey)).toEqual(testUser);
    expect(client.getQueryData(friendshipsKey)).toEqual(fullList());
  },
);
it.each([400, 403, 500, "network"])(
  "delete %s preserves accepted friend and cached access until a successful removal",
  async (status) => {
    mockList();
    server.use(
      http.delete(`${friendshipUrl}/${charlie.id}`, () =>
        status === "network"
          ? HttpResponse.error()
          : HttpResponse.json({ error: "Secret" }, { status: Number(status) }),
      ),
    );
    const { client } = renderFriendsRoute("/friends");
    client.setQueryData(detailKey(testSetup.id), testSetup);
    await screen.findByText(charlie.nickname);
    const events = userEvent.setup();
    await events.click(screen.getByRole("button", { name: "Remove friend" }));
    await events.click(screen.getByRole("button", { name: "Remove" }));
    await screen.findByRole("alert");
    expect(screen.getByText(charlie.nickname)).toBeInTheDocument();
    expect(client.getQueryData(currentUserKey)).toEqual(testUser);
    expect(client.getQueryData(detailKey(testSetup.id))).toEqual(testSetup);
  },
);
it.each(["accept", "reject", "cancel"] as const)(
  "%s updates matching search-result relationship state from the refreshed list",
  async (action) => {
    let changed = false;
    server.use(
      http.get(friendshipUrl, () => {
        const list = emptyList();
        if (!changed)
          list[action === "cancel" ? "outgoing" : "incoming"] = [item(driver)];
        if (changed && action === "accept") list.accepted = [item(driver)];
        return HttpResponse.json(list);
      }),
      action === "accept"
        ? http.post(`${friendshipUrl}/${driver.id}/accept`, () => {
            changed = true;
            return HttpResponse.json(relationship("accepted"));
          })
        : http.delete(`${friendshipUrl}/${driver.id}`, () => {
            changed = true;
            return new HttpResponse(null, { status: 204 });
          }),
    );
    mockDriverSearch();
    renderFriendsRoute("/friends");
    const row = await searchDriver();
    await userEvent.setup().click(
      within(row).getByRole("button", {
        name:
          action === "accept"
            ? "Accept"
            : action === "reject"
              ? "Reject"
              : "Cancel request",
      }),
    );
    const results = within(screen.getByRole("region", { name: "Find people" }));
    if (action === "accept") {
      await results.findByText("Friends", { exact: true });
      expect(
        results.queryByRole("button", { name: "Add friend" }),
      ).not.toBeInTheDocument();
    } else await results.findByRole("button", { name: "Add friend" });
  },
);
