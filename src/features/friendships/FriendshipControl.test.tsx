import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "../setups/testFixtures";
import { userSetupsKey } from "../setups/queries";
import {
  alice,
  bob,
  emptyList,
  friendshipUrl,
  item,
  mockList,
  relationship,
  renderFriendsRoute,
  searchUrl,
} from "./testUtils";

function mockProfile(user: components["schemas"]["PublicProfile"] = alice) {
  server.use(
    http.get(`${apiUrl}/api/v1/users/${user.id}`, () =>
      HttpResponse.json(user),
    ),
    http.get(`${apiUrl}/api/v1/users/${user.id}/setups`, () =>
      HttpResponse.json([]),
    ),
  );
}
async function open(surface: "profile" | "search") {
  mockProfile();
  server.use(http.get(searchUrl, () => HttpResponse.json([alice])));
  const view = renderFriendsRoute(
    surface === "profile" ? `/users/${alice.id}` : "/friends",
  );
  if (surface === "search") {
    fireEvent.change(await screen.findByRole("textbox", { name: "Nickname" }), {
      target: { value: "Alice" },
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Search" }));
    await within(
      screen.getByRole("region", { name: "Find people" }),
    ).findByRole("link", { name: alice.nickname });
  } else await screen.findByRole("heading", { name: alice.nickname });
  return view;
}
function controls(surface: "profile" | "search") {
  return surface === "profile"
    ? within(document.querySelector(".profile-header")! as HTMLElement)
    : within(screen.getByRole("region", { name: "Find people" }));
}
it.each(["none", "incoming", "outgoing", "accepted"] as const)(
  "direct profile renders backend %s state",
  async (state) => {
    const list = emptyList();
    if (state !== "none") list[state] = [item(alice, bob.id)];
    mockList(list);
    await open("profile");
    const ui = controls("profile");
    if (state === "none" || state === "incoming")
      expect(
        await ui.findByRole("button", {
          name: state === "none" ? "Add friend" : "Accept friendship",
        }),
      ).toBeEnabled();
    else
      expect(
        await ui.findByText(state === "outgoing" ? "Request sent" : "Friends"),
      ).toBeInTheDocument();
    expect(
      ui.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
  },
);
it.each(["profile", "search"] as const)(
  "%s hides self actions",
  async (surface) => {
    const self = {
      id: testUser.id,
      nickname: testUser.nickname,
      avatar_url: null,
    };
    mockList();
    server.use(http.get(searchUrl, () => HttpResponse.json([self])));
    mockProfile(self);
    renderFriendsRoute(
      surface === "profile" ? `/users/${self.id}` : "/friends",
    );
    if (surface === "search") {
      fireEvent.change(await screen.findByRole("textbox"), {
        target: { value: self.nickname },
      });
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Search" }));
      await within(
        screen.getByRole("region", { name: "Find people" }),
      ).findByRole("link", { name: self.nickname });
    } else await screen.findByText("No visible setups.");
    expect(
      screen.queryByRole("button", { name: "Add friend" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept friendship" }),
    ).not.toBeInTheDocument();
  },
);
it.each(["profile", "search"] as const)(
  "%s sends once and refreshes outgoing state",
  async (surface) => {
    let sent = false,
      posts = 0;
    server.use(
      http.get(friendshipUrl, () =>
        HttpResponse.json({
          ...emptyList(),
          outgoing: sent ? [item(alice)] : [],
        }),
      ),
      http.post(friendshipUrl, async ({ request }) => {
        posts++;
        expect(request.credentials).toBe("include");
        expect(await request.json()).toEqual({ user_id: alice.id });
        await delay(80);
        sent = true;
        return HttpResponse.json(relationship("pending", alice), {
          status: 201,
        });
      }),
    );
    await open(surface);
    const ui = controls(surface);
    const events = userEvent.setup();
    await events.click(await ui.findByRole("button", { name: "Add friend" }));
    const pending = ui.getByRole("button", { name: "Sending…" });
    expect(pending).toBeDisabled();
    await events.click(pending);
    await ui.findByText("Request sent");
    expect(posts).toBe(1);
  },
);
it.each(["profile", "search"] as const)(
  "%s accepts existing ID and refreshes profile, search and visible setups",
  async (surface) => {
    let accepted = false,
      posts = 0;
    server.use(
      http.get(friendshipUrl, () =>
        HttpResponse.json({
          ...emptyList(),
          incoming: accepted ? [] : [item(alice, bob.id)],
          accepted: accepted ? [item(alice, bob.id)] : [],
        }),
      ),
      http.post(`${friendshipUrl}/${bob.id}/accept`, async ({ request }) => {
        posts++;
        expect(request.credentials).toBe("include");
        expect(await request.text()).toBe("");
        await delay(80);
        accepted = true;
        return HttpResponse.json(relationship("accepted", alice));
      }),
    );
    const { router, client } = await open(surface);
    server.use(
      http.get(`${apiUrl}/api/v1/users/${alice.id}/setups`, () =>
        HttpResponse.json(
          accepted
            ? [
                {
                  ...testSetup,
                  owner_id: alice.id,
                  visibility: "friends",
                  title: "Friends build",
                },
              ]
            : [],
        ),
      ),
    );
    const ui = controls(surface);
    const events = userEvent.setup();
    await events.click(
      await ui.findByRole("button", { name: "Accept friendship" }),
    );
    const pending = ui.getByRole("button", { name: "Accepting…" });
    expect(pending).toBeDisabled();
    await events.click(pending);
    await ui.findByText("Friends", { exact: true });
    expect(posts).toBe(1);
    if (surface === "search")
      await act(async () => {
        await router.navigate(`/users/${alice.id}`);
      });
    await screen.findByText("Friends build");
    expect(client.getQueryData(userSetupsKey(alice.id))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Friends build" }),
      ]),
    );
    if (surface === "profile") {
      await act(async () => {
        await router.navigate("/friends");
      });
      fireEvent.change(await screen.findByRole("textbox"), {
        target: { value: "Alice" },
      });
      await events.click(screen.getByRole("button", { name: "Search" }));
      await controls("search").findByText("Friends", { exact: true });
    }
  },
);
it.each([500, "network"] as const)(
  "profile friendship %s blocks actions, preserves profile/setups and retries",
  async (failure) => {
    let calls = 0;
    server.use(
      http.get(friendshipUrl, async () => {
        calls++;
        await delay(50);
        return calls > 1
          ? HttpResponse.json(emptyList())
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json({ error: "Secret" }, { status: failure });
      }),
    );
    await open("profile");
    await screen.findByText("Loading friendship…");
    expect(
      screen.queryByRole("button", { name: "Add friend" }),
    ).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Retry friendship" });
    expect(
      screen.getByRole("heading", { name: alice.nickname }),
    ).toBeInTheDocument();
    expect(screen.getByText("No visible setups.")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry friendship" }));
    await screen.findByRole("button", { name: "Add friend" });
    expect(calls).toBe(2);
  },
);
it.each([404, 409])(
  "profile stale accept %s refetches safely without retrying POST",
  async (status) => {
    let stale = false,
      posts = 0;
    server.use(
      http.get(friendshipUrl, () =>
        HttpResponse.json({
          ...emptyList(),
          incoming: stale ? [] : [item(alice, bob.id)],
        }),
      ),
      http.post(`${friendshipUrl}/${bob.id}/accept`, () => {
        posts++;
        stale = true;
        return HttpResponse.json({ error: "Secret" }, { status });
      }),
    );
    await open("profile");
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Accept friendship" }));
    await screen.findByRole("alert");
    await screen.findByRole("button", { name: "Add friend" });
    expect(posts).toBe(1);
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  },
);
it("profile send conflict refreshes to incoming Accept friendship", async () => {
  let conflict = false,
    posts = 0;
  server.use(
    http.get(friendshipUrl, () =>
      HttpResponse.json({
        ...emptyList(),
        incoming: conflict ? [item(alice)] : [],
      }),
    ),
    http.post(friendshipUrl, () => {
      posts++;
      conflict = true;
      return HttpResponse.json({ error: "Conflict" }, { status: 409 });
    }),
  );
  await open("profile");
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Add friend" }));
  await screen.findByRole("button", { name: "Accept friendship" });
  expect(posts).toBe(1);
});
it.each(["list", "send", "accept"] as const)(
  "profile friendship %s 401 expires session",
  async (endpoint) => {
    mockList(
      endpoint === "accept"
        ? { ...emptyList(), incoming: [item(alice)] }
        : emptyList(),
    );
    if (endpoint === "list")
      server.use(
        http.get(friendshipUrl, () => new HttpResponse(null, { status: 401 })),
      );
    else
      server.use(
        http.post(
          endpoint === "send"
            ? friendshipUrl
            : `${friendshipUrl}/${alice.id}/accept`,
          () => new HttpResponse(null, { status: 401 }),
        ),
      );
    await open("profile");
    if (endpoint !== "list")
      await userEvent.setup().click(
        await screen.findByRole("button", {
          name: endpoint === "send" ? "Add friend" : "Accept friendship",
        }),
      );
    await screen.findByRole("button", { name: "Sign in with Google" });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: alice.nickname }),
      ).not.toBeInTheDocument(),
    );
  },
);
