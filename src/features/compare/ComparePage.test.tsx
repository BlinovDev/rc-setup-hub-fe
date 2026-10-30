import { readPair } from "./model";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, MemoryRouter } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { routes } from "../../app/router";
import { server } from "../../test/server";
import { testSetup, testUser } from "../setups/testFixtures";
import { currentUserKey } from "../auth/queries";
import { ComparisonTables } from "./ComparePage";
import { browserNavigation } from "../auth/navigation";
const a = {
  ...testSetup,
  visibility: "public" as const,
  title: "Alpha",
  notes: null,
  data: {
    suspension: {
      front: {
        camber_deg: 0,
        toe_deg: 1,
        link_lengths: [{ name: "Tie rod", length_mm: 16.23456789 }],
      },
    },
    electronics: { motor: "10.5T" },
  },
};
const b = {
  ...a,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Beta",
  chassis: null,
  chassis_model_id: null,
  data: {
    suspension: {
      front: {
        toe_deg: 2,
        link_lengths: [{ name: "tie rod", length_mm: 16.23456789 }],
      },
    },
    electronics: { motor: "10.5T" },
  },
};
const summary = (setup: typeof a | typeof b) => ({
  id: setup.id,
  title: setup.title,
  chassis: setup.chassis,
  owner: { id: testUser.id, nickname: "Safe nickname", avatar_url: null },
  created_at: setup.created_at,
  updated_at: setup.updated_at,
  cover_photo: null,
});
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.restoreAllMocks();
});
function mount(path = "/compare", member = false) {
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      member
        ? HttpResponse.json(testUser)
        : new HttpResponse(null, { status: 401 }),
    ),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router, ...view };
}
function handlers() {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/visible`, () =>
      HttpResponse.json({ items: [summary(a), summary(b)], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${a.id}`, () => HttpResponse.json(a)),
    http.get(`${apiUrl}/api/v1/setups/${b.id}`, () => HttpResponse.json(b)),
    http.get(`${apiUrl}/api/v1/setups/compare`, ({ request }) => {
      expect(request.credentials).toBe("include");
      expect(request.cache).toBe("no-store");
      const q = new URL(request.url).searchParams;
      expect([...q.keys()].sort()).toEqual(["left_id", "right_id"]);
      return HttpResponse.json({ left: a, right: b });
    }),
  );
}
const pairURL = `/compare?left_id=${a.id}&right_id=${b.id}`;
it("supports standalone visible selection, no self comparison, both replacements and aligned differences", async () => {
  handlers();
  const { router } = mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Select Alpha as first setup" }),
  );
  expect(router.state.location.search).toContain(`left_id=${a.id}`);
  expect(
    await screen.findByRole("button", { name: "Select Alpha as second setup" }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Select Beta as second setup" }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Setup comparison",
  });
  expect(heading).toHaveFocus();
  expect(screen.getByText(/Different or custom chassis/)).toBeVisible();
  const front = within(
    screen.getByRole("region", { name: "Front suspension" }),
  );
  const camber = within(
    front.getByRole("rowheader", { name: /Camber/ }).closest("tr")!,
  );
  expect(camber.getAllByRole("cell").map((c) => c.textContent)).toEqual([
    "0",
    "Not specified",
  ]);
  await user.click(screen.getByRole("checkbox", { name: "Only differences" }));
  expect(
    screen.queryByRole("rowheader", { name: /Camber/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Electronics" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("rowheader", { name: /Toe/ })).toHaveTextContent(
    "Different",
  );
  expect(
    screen.queryByRole("rowheader", { name: /Tie rod/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: "Only differences" }));
  expect(screen.getByRole("heading", { name: "Electronics" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /First setup/ }));
  expect(
    await screen.findByRole("button", { name: "Select Beta as first setup" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel selection" }));
  await user.click(screen.getByRole("button", { name: /Second setup/ }));
  expect(
    await screen.findByRole("button", { name: "Select Alpha as second setup" }),
  ).toBeDisabled();
});
it("renders one clear empty-differences state and restores all fields", () => {
  const view = render(
    <MemoryRouter>
      <ComparisonTables left={a} right={{ ...a, id: b.id }} onlyDifferences />
    </MemoryRouter>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "No comparable differences found.",
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  view.rerender(
    <MemoryRouter>
      <ComparisonTables
        left={a}
        right={{ ...a, id: b.id }}
        onlyDifferences={false}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("table").length).toBeGreaterThan(15);
  expect(screen.getAllByText("Not specified").length).toBeGreaterThan(10);
});
it.each([
  "?left_id=bad",
  `?left_id=${a.id}&right_id=${a.id.toUpperCase()}`,
  `?left_id=${a.id}&left_id=${b.id}`,
])(
  "rejects malformed/duplicate/same UUID input without comparison reads: %s",
  async (query) => {
    handlers();
    mount("/compare" + query);
    expect(await screen.findByText(/Choose two distinct setups/)).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reset comparison" }));
    // Only the reset starts the selector; provide its handler before its microtask.
  },
);
it("validates parameter identities without rewriting zero", () => {
  expect(
    readPair(new URLSearchParams(`left_id=${a.id.toUpperCase()}`)),
  ).toMatchObject({ left: a.id, valid: true });
});
it("uses paginated visibility-wide search and repeats literal filters; retries errors and handles empty/invalid search", async () => {
  const calls: string[] = [];
  let fail = true;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/visible`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      calls.push(p.toString());
      if (fail) return new HttpResponse(null, { status: 500 });
      return HttpResponse.json({
        items:
          p.get("q") === "none"
            ? []
            : p.has("cursor")
              ? [summary(b)]
              : [summary(a)],
        next_cursor: p.has("cursor") || p.get("q") === "none" ? null : "opaque",
      });
    }),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Retry search" }));
  fail = false;
  await user.click(screen.getByRole("button", { name: "Retry search" }));
  await screen.findByRole("button", { name: "Select Alpha as first setup" });
  const input = screen.getByRole("textbox", {
    name: "Title or owner nickname",
  });
  await user.type(input, "100%_literal");
  await user.click(screen.getByRole("button", { name: "Search setups" }));
  await screen.findByRole("button", { name: "Select Alpha as first setup" });
  await user.click(screen.getByRole("button", { name: "Load more setups" }));
  await screen.findByRole("button", { name: "Select Beta as first setup" });
  expect(
    calls.some(
      (c) =>
        new URLSearchParams(c).get("cursor") === "opaque" &&
        new URLSearchParams(c).get("q") === "100%_literal",
    ),
  ).toBe(true);
  await user.clear(input);
  await user.type(input, "none");
  await user.click(screen.getByRole("button", { name: "Search setups" }));
  expect(
    await screen.findByText("No visible setups match this search."),
  ).toBeVisible();
  const before = calls.length;
  await user.clear(input);
  await user.type(input, "x".repeat(101));
  await user.click(screen.getByRole("button", { name: "Search setups" }));
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  expect(calls).toHaveLength(before);
});
it.each([400, 404, 429, 500])(
  "hides both sides on %s and exposes safe retry",
  async (status) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/compare`, () =>
        HttpResponse.json({ error: "secret raw backend details" }, { status }),
      ),
    );
    mount(pairURL);
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("secret");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    handlers();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry comparison" }));
    expect(
      await screen.findByRole("heading", { name: "Setup comparison" }),
    ).toBeVisible();
  },
);
it("hides protected values while rechecking, then on visibility revocation", async () => {
  handlers();
  mount(pairURL, true);
  await screen.findByRole("heading", { name: "Setup comparison" });
  let resolve!: () => void;
  const pending = new Promise<void>((r) => (resolve = r));
  server.use(
    http.get(`${apiUrl}/api/v1/setups/compare`, async () => {
      await pending;
      return new HttpResponse(null, { status: 404 });
    }),
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Refresh comparison" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  resolve();
  expect(
    await screen.findByText("One or both setups not found or unavailable."),
  ).toBeVisible();
});
it("discards an in-flight member pair on logout and never restores it from a late result", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => (resolve = r));
  let calls = 0;
  const secret = {
    ...a,
    title: "Private member setup",
    visibility: "private" as const,
  };
  server.use(
    http.get(`${apiUrl}/api/v1/setups/compare`, async () => {
      calls++;
      await pending;
      return HttpResponse.json({ left: secret, right: b });
    }),
    http.post(
      `${apiUrl}/api/v1/auth/logout`,
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
  const { client } = mount(pairURL, true);
  await waitFor(() => expect(calls).toBe(1));
  // Viewer transition removes every setup-prefixed query and remounts comparison.
  await act(async () => {
    client.setQueryData(currentUserKey, null);
  });
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeVisible();
  resolve();
  await waitFor(() => expect(calls).toBeGreaterThan(1));
  await act(async () => {
    await delay(20);
  });
  expect(screen.queryByText("Private member setup")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it("does not trust a malformed partial or non-public guest comparison", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/compare`, () =>
      HttpResponse.json({ left: { ...a, visibility: "friends" }, right: b }),
    ),
  );
  mount(pairURL);
  expect(
    await screen.findByText("One or both setups not found or unavailable."),
  ).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it("offers Compare to for an accessible public detail and preselects it without automatic OAuth", async () => {
  handlers();
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${a.id}`, () => HttpResponse.json(a)),
    http.get(`${apiUrl}/api/v1/users/${a.owner_id}`, () =>
      HttpResponse.json({ id: a.owner_id, nickname: "Safe", avatar_url: null }),
    ),
  );
  const navigate = vi
    .spyOn(browserNavigation, "assign")
    .mockImplementation(() => {});
  mount(`/setups/${a.id}`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("link", { name: "Compare to" }));
  expect(
    await screen.findByRole("region", { name: "Choose second setup" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Select Alpha as second setup" }),
  ).toBeDisabled();
  expect(navigate).not.toHaveBeenCalled();
});

it("keeps refresh focus through a successful recheck without keeping stale table bytes", async () => {
  handlers();
  mount(pairURL);
  await screen.findByRole("heading", { name: "Setup comparison" });
  const button = screen.getByRole("button", { name: "Refresh comparison" });
  await userEvent.setup().click(button);
  await screen.findByRole("heading", { name: "Setup comparison" });
  expect(
    screen.getByRole("button", { name: "Refresh comparison" }),
  ).toHaveFocus();
});
