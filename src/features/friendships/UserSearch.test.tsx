import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../../test/server";
import { apiUrl } from "../../api/config";
import {
  alice,
  bob,
  charlie,
  driver,
  emptyList,
  mockList,
  renderFriendsRoute,
  searchUrl,
} from "./testUtils";
async function search(value: string) {
  fireEvent.change(await screen.findByRole("textbox", { name: "Nickname" }), {
    target: { value },
  });
  await userEvent.setup().click(screen.getByRole("button", { name: "Search" }));
}
it("searches normalized literal nickname only on submission and derives states without per-result profile calls", async () => {
  mockList();
  let calls = 0,
    profiles = 0;
  server.use(
    http.get(searchUrl, ({ request }) => {
      calls++;
      expect(request.credentials).toBe("include");
      expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
        q: "dri%_",
      });
      return HttpResponse.json([alice, bob, charlie, driver]);
    }),
    http.get(`${apiUrl}/api/v1/users/:id`, () => {
      profiles++;
      return HttpResponse.json(alice);
    }),
  );
  renderFriendsRoute("/friends");
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "  dri%_  " },
  });
  expect(calls).toBe(0);
  await userEvent.setup().click(screen.getByRole("button", { name: "Search" }));
  const results = within(screen.getByRole("region", { name: "Find people" }));
  await results.findByText(driver.nickname);
  for (const [nickname, state] of [
    [bob.nickname, "Request sent"],
    [charlie.nickname, "Friends"],
  ]) {
    const row = results.getByText(nickname!).closest("li")!;
    expect(within(row).getByText(state!, { exact: true })).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "Add friend" }),
    ).not.toBeInTheDocument();
  }
  expect(
    within(results.getByText(driver.nickname).closest("li")!).getByRole(
      "button",
      { name: "Add friend" },
    ),
  ).toBeInTheDocument();
  expect(
    within(results.getByText(alice.nickname).closest("li")!).getByRole(
      "button",
      { name: "Accept friendship" },
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/@example/)).not.toBeInTheDocument();
  expect(calls).toBe(1);
  expect(profiles).toBe(0);
  expect(results.getByRole("link", { name: driver.nickname })).toHaveAttribute(
    "href",
    `/users/${driver.id}`,
  );
});
it.each(["", "   ", "a".repeat(65), "bad\0nickname"])(
  "does not request for empty/invalid nickname %s",
  async (value) => {
    mockList(emptyList());
    let calls = 0;
    server.use(
      http.get(searchUrl, () => {
        calls++;
        return HttpResponse.json([]);
      }),
    );
    renderFriendsRoute("/friends");
    await search(value);
    expect(calls).toBe(0);
    if (value.trim())
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Use at most 64 characters",
      );
    else
      expect(
        screen.getByText("Search by nickname to find people."),
      ).toBeInTheDocument();
  },
);
it("shows search loading and successful empty results", async () => {
  mockList();
  server.use(
    http.get(searchUrl, async () => {
      await delay(80);
      return HttpResponse.json([]);
    }),
  );
  renderFriendsRoute("/friends");
  await search("dri");
  await screen.findByText("Searching people…");
  await screen.findByText("No people found.");
});
it.each([400, 500, "network"])(
  "search %s preserves auth and offers an explicit retry",
  async (failure) => {
    mockList();
    let calls = 0;
    server.use(
      http.get(searchUrl, () => {
        calls++;
        return calls > 1
          ? HttpResponse.json([driver])
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json(
                { error: "Secret internals" },
                { status: Number(failure) },
              );
      }),
    );
    renderFriendsRoute("/friends");
    await search("dri");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      failure === 400 ? "Invalid nickname search" : "Unable to search people",
    );
    expect(screen.queryByText("Secret internals")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry search" }));
    await screen.findByText(driver.nickname);
    expect(calls).toBe(2);
  },
);
it("search 401 clears the existing current-user state", async () => {
  mockList();
  server.use(
    http.get(searchUrl, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderFriendsRoute("/friends");
  await search("dri");
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
