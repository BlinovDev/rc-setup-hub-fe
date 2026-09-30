import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../../app/router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../../test/server";
import { apiUrl } from "../../api/config";
import { friendshipsKey } from "./queries";
import {
  alice,
  bob,
  charlie,
  emptyList,
  friendshipUrl,
  fullList,
  mockList,
  renderFriendsRoute,
} from "./testUtils";
it("renders other participants directly in the correct buckets with safe profile fields and navigation", async () => {
  const list = fullList();
  list.incoming[0]!.id = "c61393b6-daa0-4eb8-923c-57aedbb46a80";
  mockList(list);
  renderFriendsRoute("/friends");
  const incoming = await screen.findByRole("region", {
    name: "Incoming requests",
  });
  expect(within(incoming).getByText(alice.nickname)).toBeInTheDocument();
  expect(
    within(incoming).getByRole("button", { name: "Accept" }),
  ).toBeInTheDocument();
  expect(
    within(incoming).getByRole("button", { name: "Reject" }),
  ).toBeInTheDocument();
  const outgoing = screen.getByRole("region", { name: "Outgoing requests" });
  expect(within(outgoing).getByText(bob.nickname)).toBeInTheDocument();
  expect(
    within(outgoing).getByRole("button", { name: "Cancel request" }),
  ).toBeInTheDocument();
  const friends = screen.getByRole("region", { name: "Friends" });
  expect(within(friends).getByText(charlie.nickname)).toBeInTheDocument();
  expect(
    within(friends).getByRole("button", { name: "Remove friend" }),
  ).toBeInTheDocument();
  expect(incoming.querySelector("img")).toHaveAttribute(
    "src",
    alice.avatar_url,
  );
  expect(outgoing.querySelector("img")).toBeNull();
  expect(screen.queryByText(/@example/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute(
    "href",
    "/friends",
  );
  for (const user of [alice, bob, charlie])
    expect(screen.getByRole("link", { name: user.nickname })).toHaveAttribute(
      "href",
      `/users/${user.id}`,
    );
});
it("shows loading followed by all successful empty sections", async () => {
  server.use(
    http.get(friendshipUrl, async () => {
      await delay(80);
      return HttpResponse.json(emptyList());
    }),
  );
  renderFriendsRoute("/friends");
  await screen.findByText("Loading friendships…");
  for (const text of [
    "No incoming requests.",
    "No outgoing requests.",
    "No friends yet.",
  ])
    expect(await screen.findByText(text)).toBeInTheDocument();
});
it.each([500, "network"])(
  "list %s is an explicit error, blocks relationship actions, and supports retry",
  async (failure) => {
    let calls = 0;
    server.use(
      http.get(friendshipUrl, () => {
        calls++;
        return calls > 1
          ? HttpResponse.json(fullList())
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json({ error: "Secret internals" }, { status: 500 });
      }),
    );
    renderFriendsRoute("/friends");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load friendships",
    );
    expect(screen.queryByText("No friends yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add friend" }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry friendships" }));
    await screen.findByText(alice.nickname);
    expect(calls).toBe(2);
  },
);
it("friendship list 401 ends the existing session", async () => {
  server.use(
    http.get(friendshipUrl, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderFriendsRoute("/friends");
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(
    screen.queryByRole("heading", { name: "Friendships" }),
  ).not.toBeInTheDocument();
});
it("unauthenticated visitors never request friendship data", async () => {
  let calls = 0;
  mockList();
  server.use(
    http.get(friendshipUrl, () => {
      calls++;
      return HttpResponse.json(emptyList());
    }),
  );
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      HttpResponse.json({ error: "No session" }, { status: 401 }),
    ),
  );
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ["/friends"] })}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(calls).toBe(0);
  expect(client.getQueryData(friendshipsKey)).toBeUndefined();
  client.clear();
});
