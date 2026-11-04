import type { components } from "../../api/generated/schema";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { currentUserKey } from "../auth/queries";
import { renderSetupRoute } from "../setups/testUtils";
import { testUser } from "../setups/testFixtures";
const other = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: testUser.id,
  nickname: testUser.nickname,
  avatar_url: null,
  instagram_url: "https://instagram.com/driver",
  tiktok_url: "https://tiktok.com/@driver",
  youtube_url: "https://youtube.com/@driver",
  member_since: testUser.created_at,
  public_setup_count: 2,
};
beforeEach(() =>
  server.use(
    http.get(`${apiUrl}/api/v1/users/:id`, ({ params }) =>
      HttpResponse.json({ ...profile, id: params.id }),
    ),
    http.get(`${apiUrl}/api/v1/users/:id/public-setups`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/friendships`, () =>
      HttpResponse.json({ incoming: [], outgoing: [], accepted: [] }),
    ),
  ),
);
afterEach(() => vi.restoreAllMocks());
it.each([testUser.id, other])(
  "shows only public stats and owner-only editor link for %s",
  async (id) => {
    renderSetupRoute(`/users/${id}`);
    await screen.findByRole("heading", { name: testUser.nickname });
    expect(screen.getByText("2 public setups")).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.queryByText(testUser.email)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Change profile details" }) !== null,
    ).toBe(id === testUser.id);
    const links = within(
      screen.getByRole("navigation", { name: "Driver social profiles" }),
    ).getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName();
    }
    expect(
      screen.getByRole("heading", { name: "Public setups" }),
    ).toBeInTheDocument();
  },
);
it("omits unsafe/absent social links without inferring stats from private lists", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
      HttpResponse.json({
        ...profile,
        instagram_url: "javascript:evil",
        tiktok_url: null,
        youtube_url: "https://evil.test/@driver",
        public_setup_count: 0,
      }),
    ),
  );
  const { router } = renderSetupRoute(`/users/${testUser.id}`);
  await screen.findByText("0 public setups");
  expect(
    screen.queryByRole("navigation", { name: "Driver social profiles" }),
  ).not.toBeInTheDocument();
  server.use(
    http.get(`${apiUrl}/api/v1/users/${testUser.id}/setups`, () =>
      HttpResponse.json([]),
    ),
  );
  await act(() => router.navigate(`/users/${testUser.id}?view=visible`));
  await screen.findByText("No visible setups.");
  expect(screen.getByText("0 public setups")).toBeInTheDocument();
});
it("Account, mobile avatar and desktop nickname all navigate to own view, then explicit edit", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  const { router } = renderSetupRoute("/my/setups");
  await screen.findByText("No setups yet.");
  const user = userEvent.setup();
  for (const locator of [
    () =>
      within(screen.getByRole("navigation", { name: "Main" })).getByRole(
        "link",
        { name: "Account" },
      ),
    () =>
      document.querySelector<HTMLAnchorElement>(
        ".mobile-session .header-avatar-link",
      )!,
    () =>
      within(screen.getByRole("region", { name: "Your session" })).getByRole(
        "link",
        { name: testUser.nickname },
      ),
  ]) {
    await user.click(locator());
    await screen.findByRole("link", { name: "Change profile details" });
    expect(router.state.location.pathname).toBe(`/users/${testUser.id}`);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(() => router.navigate("/my/setups"));
    await screen.findByText("No setups yet.");
  }
  await user.click(screen.getByRole("button", { name: "Open account menu" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Account and navigation" }),
    ).getByRole("link", { name: "Account" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    await screen.findByRole("link", { name: "Change profile details" }),
  );
  await screen.findByRole("heading", { name: "Change profile details" });
  expect(router.state.location.pathname).toBe("/settings");
});
it("guest transition removes owner editing and private account state", async () => {
  const { client } = renderSetupRoute(`/users/${testUser.id}`);
  await screen.findByRole("link", { name: "Change profile details" });
  await act(async () => {
    client.setQueryData(currentUserKey, null);
  });
  await screen.findByRole("heading", { name: testUser.nickname });
  expect(
    screen.queryByRole("link", { name: "Change profile details" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Account" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("2 public setups")).toBeInTheDocument();
});
it("saves and clears social fields without discarding nickname or other links", async () => {
  let saved: components["schemas"]["User"] = {
    ...testUser,
    instagram_url: profile.instagram_url,
    tiktok_url: profile.tiktok_url,
    youtube_url: profile.youtube_url,
  };
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      const body = (await request.json()) as components["schemas"]["PatchMe"];
      bodies.push(body);
      saved = { ...saved, ...body };
      return HttpResponse.json(saved);
    }),
  );
  const { client } = renderSetupRoute("/settings");
  await screen.findByLabelText("Nickname");
  await act(() => client.setQueryData(currentUserKey, saved));
  // A fresh editor reads the latest server fields.
  const form = screen.getByLabelText("Nickname").closest("form")!;
  fireEvent.change(screen.getByLabelText("Instagram URL"), {
    target: { value: "https://instagram.com/newdriver" },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save profile details" }));
  await screen.findByText("Profile details saved.");
  expect(bodies[0]).toEqual({
    instagram_url: "https://instagram.com/newdriver",
  });
  fireEvent.change(screen.getByLabelText("Instagram URL"), {
    target: { value: "" },
  });
  fireEvent.submit(form);
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]).toEqual({ instagram_url: null });
  expect(screen.getByLabelText("Nickname")).toHaveValue(testUser.nickname);
});
it("rejects an unsafe social URL before sending any mutation", async () => {
  let writes = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, () => {
      writes++;
      return HttpResponse.json(testUser);
    }),
  );
  renderSetupRoute("/settings");
  await screen.findByLabelText("Instagram URL");
  fireEvent.change(screen.getByLabelText("Instagram URL"), {
    target: { value: "https://instagram.com/redirect?next=evil" },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save profile details" }));
  await screen.findByRole("alert");
  expect(writes).toBe(0);
});
it("a late old-session profile response cannot restore private state after logout", async () => {
  server.use(
    http.patch(`${apiUrl}/api/v1/me`, async () => {
      await delay(100);
      return HttpResponse.json({ ...testUser, nickname: "Old secret" });
    }),
  );
  const { client } = renderSetupRoute("/settings");
  await screen.findByLabelText("Nickname");
  fireEvent.change(screen.getByLabelText("Nickname"), {
    target: { value: "Old secret" },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save profile details" }));
  await act(() => client.setQueryData(currentUserKey, null));
  await screen.findByRole("button", { name: "Sign in with Google" });
  await act(() => new Promise((r) => setTimeout(r, 150)));
  expect(client.getQueryData(currentUserKey)).toBeNull();
  expect(screen.queryByText("Old secret")).not.toBeInTheDocument();
});
