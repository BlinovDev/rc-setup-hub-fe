import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { afterEach, expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { routes } from "../../app/router";
import { server } from "../../test/server";
import { currentUserKey } from "../auth/queries";

const user = {
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
  nickname: "Track Driver",
  email: "driver@example.test",
  avatar_url: "https://example.test/avatar.png",
  created_at: "2026-09-30T12:00:00Z",
} satisfies components["schemas"]["User"];
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function setup(avatar: string | null = user.avatar_url, signedIn = true) {
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      signedIn
        ? HttpResponse.json({ ...user, avatar_url: avatar })
        : HttpResponse.json({ error: "No session" }, { status: 401 }),
    ),
  );
  const client = new QueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ["/settings"] })}
      />
    </QueryClientProvider>,
  );
  return client;
}
async function edit(value: string) {
  const input = await screen.findByRole("textbox", { name: "Nickname" });
  fireEvent.change(input, { target: { value } });
  return input;
}
it.each([user.avatar_url, null])(
  "renders settings with avatar %s",
  async (avatar) => {
    setup(avatar);
    expect(await screen.findByText(user.email)).toBeInTheDocument();
    expect(screen.getByText(user.nickname)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nickname" })).toHaveValue(
      user.nickname,
    );
    if (avatar)
      expect(document.querySelector("img")).toHaveAttribute("src", avatar);
    else expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Save nickname" }),
    ).toBeDisabled();
  },
);
it("normalizes the PATCH body and updates settings, root shell and only the current-user cache", async () => {
  const saved = { ...user, nickname: "New Driver" };
  let patches = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/setups/search`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.patch(`${apiUrl}/api/v1/me`, async ({ request }) => {
      patches++;
      expect(request.credentials).toBe("include");
      expect(await request.json()).toEqual({ nickname: "New Driver" });
      await delay(50);
      return HttpResponse.json(saved);
    }),
  );
  const client = setup();
  client.setQueryData(["unrelated"], "keep");
  await edit("  New Driver  ");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save nickname" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Nickname saved.",
  );
  expect(screen.getByText("New Driver")).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("New Driver");
  expect(client.getQueryData(currentUserKey)).toEqual(saved);
  expect(client.getQueryData(["unrelated"])).toBe("keep");
  await userEvent.setup().click(screen.getByRole("link", { name: "Home" }));
  expect(screen.getByText("New Driver")).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "Nickname" }),
  ).not.toBeInTheDocument();
  expect(patches).toBe(1);
});
it("does not PATCH an unchanged normalized nickname even on form submission", async () => {
  let patches = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, () => {
      patches++;
      return HttpResponse.json(user);
    }),
  );
  setup();
  const input = await edit("  Track Driver  ");
  expect(screen.getByRole("button", { name: "Save nickname" })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  await act(async () => {});
  expect(patches).toBe(0);
  expect(screen.getByText(user.nickname)).toBeInTheDocument();
});
it.each([
  ["   ", "Enter a nickname."],
  ["a".repeat(65), "Use at most 64 characters."],
])("validates nickname locally: %s", async (value, message) => {
  setup();
  await edit(value!);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save nickname" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message!);
});
it.each([
  [400, "That nickname is invalid."],
  [409, "That nickname is already in use."],
  [415, "Unable to send the update."],
  [500, "Unable to save your nickname."],
])("handles PATCH %s and supports retry", async (status, message) => {
  let requests = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, () => {
      requests++;
      return requests === 1
        ? HttpResponse.json(
            { error: "Secret internal details" },
            { status: Number(status) },
          )
        : HttpResponse.json({ ...user, nickname: "Changed" });
    }),
  );
  setup();
  await edit("Changed");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save nickname" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(String(message));
  expect(screen.queryByText("Secret internal details")).not.toBeInTheDocument();
  expect(screen.getByText(user.nickname)).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save nickname" }));
  expect(await screen.findByText("Changed")).toBeInTheDocument();
  expect(requests).toBe(2);
});
it("removes settings data on PATCH 401", async () => {
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  setup();
  await edit("Changed");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save nickname" }));
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("removes settings data on later current-user 401", async () => {
  const client = setup();
  await screen.findByText(user.email);
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  await act(async () => {
    await client.invalidateQueries({ queryKey: currentUserKey, exact: true });
  });
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByText(user.nickname)).not.toBeInTheDocument();
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
});
it("never renders settings for an unauthenticated visitor", async () => {
  setup(null, false);
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
