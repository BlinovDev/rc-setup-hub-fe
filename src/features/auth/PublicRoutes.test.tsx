import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { components } from "../../api/generated/schema";
import { routes } from "../../app/router";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "../setups/testFixtures";
import { currentUserKey } from "./queries";
import {
  detailKey,
  mineKey,
  userSetupsKey,
  withSession,
} from "../setups/queries";
import { browserNavigation, googleLoginUrl } from "./navigation";

const setup = {
  ...testSetup,
  visibility: "public" as const,
  title: "Public drift setup",
};
const owner = { id: testUser.id, nickname: "Public pilot", avatar_url: null };
const item = {
  id: setup.id,
  title: setup.title,
  owner,
  chassis: setup.chassis,
  chassis_model_id: setup.chassis_model_id,
  visibility: "public",
  cover_photo: null,
  schema_version: 1,
  created_at: setup.created_at,
  updated_at: setup.updated_at,
} satisfies components["schemas"]["SetupSearchItem"];
const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  setup_id: setup.id,
  width: 400,
  height: 600,
  thumbnail_width: 400,
  thumbnail_height: 400,
  content_type: "image/jpeg",
  is_cover: true,
  crop: null,
  thumbnail_revision: 0,
  created_at: setup.created_at,
  url: "/image",
  thumbnail_url: "/thumbnail",
} satisfies components["schemas"]["SetupPhoto"];
let me: typeof testUser | null;
let clients: QueryClient[] = [];
beforeEach(() => {
  me = null;
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      me
        ? HttpResponse.json(me)
        : HttpResponse.json({ error: "No session" }, { status: 401 }),
    ),
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/setups/search`, () =>
      HttpResponse.json({ items: [item], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      HttpResponse.json(setup),
    ),
    http.get(`${apiUrl}/api/v1/users/${owner.id}`, () =>
      HttpResponse.json(owner),
    ),
    http.get(`${apiUrl}/api/v1/users/${owner.id}/public-setups`, () =>
      HttpResponse.json({ items: [item], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/friendships`, () =>
      HttpResponse.json({ incoming: [], outgoing: [], accepted: [] }),
    ),
    http.post(`${apiUrl}/api/v1/auth/logout`, () => {
      me = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:guest-photo");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function show(path: string) {
  const client = new QueryClient();
  clients.push(client);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}
const robots = () =>
  document.head.querySelector('meta[name="robots"]')?.getAttribute("content");

it("Explore works with /me 401, keeps safe URL filters/cursors and offers explicit sign-in", async () => {
  const navigate = vi
    .spyOn(browserNavigation, "assign")
    .mockImplementation(() => {});
  const requests: string[] = [];
  server.use(
    http.get(`${apiUrl}/api/v1/setups/search`, ({ request }) => {
      expect(request.credentials).toBe("include");
      const params = new URL(request.url).searchParams;
      requests.push(params.toString());
      return HttpResponse.json({
        items: [
          params.has("cursor")
            ? { ...item, id: photo.id, title: "Second public setup" }
            : item,
        ],
        next_cursor: params.has("cursor") ? null : "opaque",
      });
    }),
  );
  const { client } = show("/?q=drift");
  await screen.findByText(setup.title);
  expect(client.getQueryData(currentUserKey)).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByText("Second public setup");
  expect(requests).toEqual([
    "limit=20&q=drift",
    "limit=20&q=drift&cursor=opaque",
  ]);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(navigate).toHaveBeenCalledExactlyOnceWith(googleLoginUrl);
  expect(screen.queryByText(testUser.email)).not.toBeInTheDocument();
  expect(robots()).toBe("noindex, nofollow");
});

it.each([
  "/my/setups",
  "/my/setups/new",
  `/my/setups/${setup.id}/edit`,
  "/friends",
  "/settings",
])(
  "keeps protected deep link %s behind a non-automatic sign-in CTA",
  async (path) => {
    const navigate = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});
    show(path);
    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Save setup" }),
    ).not.toBeInTheDocument();
    expect(robots()).toBe("noindex, nofollow");
  },
);

it("guests read public technical data and credentialed no-store media with safe metadata", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}/photos`, () =>
      HttpResponse.json([photo]),
    ),
    http.get(
      `${apiUrl}/api/v1/setups/${setup.id}/photos/${photo.id}/:variant`,
      ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.cache).toBe("no-store");
        return new HttpResponse(new Uint8Array([255, 216, 255]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      },
    ),
  );
  show(`/setups/${setup.id}?tracking=ignored`);
  await screen.findByRole("heading", { name: setup.title });
  await screen.findByRole("link", { name: owner.nickname });
  await waitFor(() =>
    expect(screen.getByAltText("Setup photo 1")).toHaveAttribute(
      "src",
      "blob:guest-photo",
    ),
  );
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(document.title).toBe(`${setup.title} | RC Setup Hub`);
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    "content",
    expect.stringContaining(setup.title),
  );
  expect(robots()).toBe("index, follow");
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${window.location.origin}/setups/${setup.id}`,
  );
  expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute(
    "content",
    document.title,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Enlarge photo 1 (cover)" }),
  );
  await screen.findByRole("dialog", { name: "Enlarged setup photo" });
  await waitFor(() =>
    expect(screen.getByAltText("Enlarged setup photo 1")).toHaveAttribute(
      "src",
      "blob:guest-photo",
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Close photo 1" }));
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it.each([404, 400])(
  "unavailable detail %s stays generic and non-indexable",
  async (status) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
        HttpResponse.json({ error: "hidden private title" }, { status }),
      ),
    );
    show(`/setups/${setup.id}`);
    await screen.findByText("Setup not found or unavailable.");
    expect(screen.queryByText("hidden private title")).not.toBeInTheDocument();
    expect(robots()).toBe("noindex, nofollow");
  },
);

it.each([false, true])(
  "safe public profile defaults to paginated public-only endpoint, signed-in=%s",
  async (signedIn) => {
    me = signedIn ? testUser : null;
    let protectedCalls = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/users/${owner.id}/setups`, () => {
        protectedCalls++;
        return HttpResponse.json([testSetup]);
      }),
      http.get(
        `${apiUrl}/api/v1/users/${owner.id}/public-setups`,
        ({ request }) => {
          const params = new URL(request.url).searchParams;
          expect(params.get("limit")).toBe("20");
          return HttpResponse.json({
            items: [
              params.has("cursor")
                ? { ...item, id: photo.id, title: "Profile second setup" }
                : item,
            ],
            next_cursor: params.has("cursor") ? null : "next",
          });
        },
      ),
    );
    show(`/users/${owner.id}`);
    await screen.findByRole("heading", { name: owner.nickname });
    await screen.findByText(setup.title);
    expect(protectedCalls).toBe(0);
    expect(screen.queryByText(testUser.email)).not.toBeInTheDocument();
    expect(screen.queryByText("Visible setups")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Profile second setup");
    if (signedIn) {
      await userEvent.click(
        screen.getByRole("button", { name: "Setups visible to you" }),
      );
      await screen.findByRole("heading", { name: "Visible setups" });
      await screen.findByText(testSetup.title);
      expect(protectedCalls).toBe(1);
    } else
      expect(
        screen.getByRole("button", { name: "Sign in to add friends" }),
      ).toBeInTheDocument();
    expect(robots()).toBe("noindex, nofollow");
  },
);

it("guest empty and failed public lists keep safe profile visible and retry independently", async () => {
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/users/${owner.id}/public-setups`, () =>
      ++calls === 1
        ? HttpResponse.json({ error: "db secret" }, { status: 429 })
        : HttpResponse.json({ items: [], next_cursor: null }),
    ),
  );
  show(`/users/${owner.id}`);
  await screen.findByRole("button", { name: "Retry public setups" });
  expect(
    screen.getByRole("heading", { name: owner.nickname }),
  ).toBeInTheDocument();
  expect(screen.queryByText("db secret")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Retry public setups" }),
  );
  await screen.findByText("No public setups yet.");
  expect(calls).toBe(2);
});

it("login/logout and Back purge private details, blob URLs and late old-session results", async () => {
  const privateSetup = {
    ...setup,
    title: "Private driver data",
    visibility: "private" as const,
  };
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      me
        ? HttpResponse.json(privateSetup)
        : HttpResponse.json({ error: "Not found" }, { status: 404 }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${setup.id}/photos`, () =>
      me ? HttpResponse.json([photo]) : new HttpResponse(null, { status: 404 }),
    ),
    http.get(
      `${apiUrl}/api/v1/setups/${setup.id}/photos/${photo.id}/:variant`,
      () =>
        new HttpResponse(new Uint8Array([255, 216, 255]), {
          headers: { "Content-Type": "image/jpeg" },
        }),
    ),
  );
  const { client, router } = show("/");
  await screen.findByRole("button", { name: "Sign in" });
  me = testUser;
  await act(async () => {
    await client.invalidateQueries({ queryKey: currentUserKey, exact: true });
  });
  await act(async () => {
    await router.navigate(`/setups/${setup.id}`);
  });
  await screen.findByRole("heading", { name: privateSetup.title });
  await waitFor(() =>
    expect(screen.getByAltText("Setup photo 1")).toHaveAttribute(
      "src",
      "blob:guest-photo",
    ),
  );
  expect(robots()).toBe("noindex, nofollow");
  client.setQueryData(mineKey, [privateSetup]);
  client.setQueryData(userSetupsKey(testUser.id), [privateSetup]);
  let finish!: (value: string) => void;
  const late = withSession(
    client,
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  ).catch((error: unknown) => error);
  await userEvent.click(
    screen.getAllByRole("button", { name: "Sign out" })[0]!,
  );
  await screen.findByRole("button", { name: "Sign in" });
  await screen.findByText("Setup not found or unavailable.");
  expect(screen.queryByText(privateSetup.title)).not.toBeInTheDocument();
  expect(screen.queryByAltText("Setup photo 1")).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:guest-photo");
  expect(client.getQueryData(mineKey)).toBeUndefined();
  expect(client.getQueryData(userSetupsKey(testUser.id))).toBeUndefined();
  finish("private late data");
  expect(await late).toBeInstanceOf(Error);
  await act(async () => {
    await router.navigate(-1);
  });
  await screen.findByText(setup.title);
  await act(async () => {
    await router.navigate(1);
  });
  await screen.findByText("Setup not found or unavailable.");
  expect(screen.queryByText(privateSetup.title)).not.toBeInTheDocument();
  expect(client.getQueryState(detailKey(setup.id))?.status).toBe("error");
});

it("public visibility revocation removes detail, social metadata and rendered blobs on refetch", async () => {
  let allowed = true;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      allowed
        ? HttpResponse.json(setup)
        : HttpResponse.json({ error: "Not found" }, { status: 404 }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${setup.id}/photos`, () =>
      HttpResponse.json([photo]),
    ),
    http.get(
      `${apiUrl}/api/v1/setups/${setup.id}/photos/${photo.id}/:variant`,
      () =>
        new HttpResponse(new Uint8Array([255, 216, 255]), {
          headers: { "Content-Type": "image/jpeg" },
        }),
    ),
  );
  const { client } = show(`/setups/${setup.id}`);
  await screen.findByRole("heading", { name: setup.title });
  await waitFor(() =>
    expect(screen.getByAltText("Setup photo 1")).toHaveAttribute(
      "src",
      "blob:guest-photo",
    ),
  );
  allowed = false;
  await act(async () => {
    await client.invalidateQueries({
      queryKey: detailKey(setup.id),
      exact: true,
    });
  });
  await screen.findByText("Setup not found or unavailable.");
  expect(screen.queryByText(setup.title)).not.toBeInTheDocument();
  expect(screen.queryByAltText("Setup photo 1")).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:guest-photo");
  expect(robots()).toBe("noindex, nofollow");
  expect(document.title).not.toContain(setup.title);
  expect(
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content"),
  ).not.toContain(setup.title);
});

it("sanitizes persisted document snapshots and rechecks cookies on BFCache restoration", async () => {
  me = testUser;
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([{ ...testSetup, title: "Private cached snapshot" }]),
    ),
  );
  const { client } = show("/my/setups");
  await screen.findByText("Private cached snapshot");
  const transition = (name: string) => {
    const event = new Event(name);
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
  };
  act(() => transition("pagehide"));
  expect(screen.queryByText("Private cached snapshot")).not.toBeInTheDocument();
  expect(client.getQueryData(mineKey)).toBeUndefined();
  me = null;
  await act(async () => transition("pageshow"));
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(client.getQueryData(currentUserKey)).toBeNull();
  expect(screen.queryByText("Private cached snapshot")).not.toBeInTheDocument();
});

it.each([400, 404])(
  "guest profile %s is unavailable without requesting a public or protected list",
  async (status) => {
    let lists = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/users/${owner.id}`, () =>
        HttpResponse.json({ error: "private owner" }, { status }),
      ),
      http.get(`${apiUrl}/api/v1/users/${owner.id}/public-setups`, () => {
        lists++;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
      http.get(`${apiUrl}/api/v1/users/${owner.id}/setups`, () => {
        lists++;
        return HttpResponse.json([]);
      }),
    );
    show(`/users/${owner.id}`);
    await screen.findByText("User not found or unavailable.");
    expect(lists).toBe(0);
    expect(screen.queryByText("private owner")).not.toBeInTheDocument();
    expect(robots()).toBe("noindex, nofollow");
  },
);

it("guest detail stays readable with no photos and an unavailable owner", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/users/${owner.id}`, () =>
      HttpResponse.json({ error: "Not found" }, { status: 404 }),
    ),
  );
  show(`/setups/${setup.id}`);
  await screen.findByRole("heading", { name: setup.title });
  await screen.findByText(/Owner unavailable/);
  await screen.findByText("No photos yet.");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  expect(robots()).toBe("index, follow");
});

it.each(["pending", "rejected"] as const)(
  "member can read a %s public setup without indexing or social metadata disclosure",
  async (moderation_status) => {
    me = testUser;
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
        HttpResponse.json({ ...setup, moderation_status }),
      ),
    );
    show(`/setups/${setup.id}`);
    await screen.findByRole("heading", { name: setup.title });
    expect(robots()).toBe("noindex, nofollow");
    expect(document.title).toBe("RC Setup Hub");
    expect(
      document.head
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content"),
    ).not.toContain(setup.notes);
  },
);

it.each(["pending", "rejected"] as const)(
  "guest cannot reuse a %s public detail payload",
  async (moderation_status) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
        HttpResponse.json({ ...setup, moderation_status }),
      ),
    );
    show(`/setups/${setup.id}`);
    await screen.findByText("Setup not found or unavailable.");
    expect(
      screen.queryByRole("heading", { name: setup.title }),
    ).not.toBeInTheDocument();
    expect(robots()).toBe("noindex, nofollow");
  },
);
