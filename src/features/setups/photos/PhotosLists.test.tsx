import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup, testUser } from "../testFixtures";
import { mockActiveCatalog, renderSetupRoute } from "../testUtils";
const cover = {
  id: "11111111-1111-4111-8111-111111111111",
  setup_id: testSetup.id,
  width: 600,
  height: 400,
  crop: null,
  thumbnail_revision: 0,
  thumbnail_width: 600,
  thumbnail_height: 400,
  content_type: "image/jpeg" as const,
  is_cover: true,
  created_at: testSetup.created_at,
  url: "/image",
  thumbnail_url: "/thumbnail",
};
beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:cover");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["/", "/my/setups", `/users/${testUser.id}`])(
  "shows returned cover and zero-photo placeholder on %s without per-card gallery/detail lookups",
  async (path) => {
    mockActiveCatalog();
    let metadata = 0,
      media = 0;
    const full = [
      { ...testSetup, cover_photo: cover },
      {
        ...testSetup,
        id: "22222222-2222-4222-8222-222222222222",
        title: "No photos",
        cover_photo: null,
      },
    ];
    server.use(
      http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json(full)),
      http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
        HttpResponse.json(testUser),
      ),
      http.get(`${apiUrl}/api/v1/users/${testUser.id}/setups`, () =>
        HttpResponse.json(full),
      ),
      http.get(`${apiUrl}/api/v1/friendships`, () =>
        HttpResponse.json({ incoming: [], outgoing: [], accepted: [] }),
      ),
      http.get(`${apiUrl}/api/v1/setups/search`, () =>
        HttpResponse.json({
          items: full.map((p) => ({
            ...p,
            visibility: "public",
            owner: {
              id: testUser.id,
              nickname: testUser.nickname,
              avatar_url: null,
            },
          })),
          next_cursor: null,
        }),
      ),
      http.get(`${apiUrl}/api/v1/setups/:id/photos`, () => {
        metadata++;
        return HttpResponse.json([]);
      }),
      http.get(`${apiUrl}/api/v1/setups/:id`, () => {
        metadata++;
        return HttpResponse.json(testSetup);
      }),
      http.get(
        `${apiUrl}/api/v1/setups/:id/photos/:photoId/thumbnail`,
        ({ request }) => {
          media++;
          expect(request.credentials).toBe("include");
          expect(request.cache).toBe("no-store");
          return new HttpResponse(new Uint8Array([1]), {
            headers: { "Content-Type": "image/jpeg" },
          });
        },
      ),
    );
    renderSetupRoute(path);
    await screen.findByText(testSetup.title);
    const image = await screen.findByAltText(`Cover of ${testSetup.title}`);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByAltText("No setup photo — placeholder")).toHaveAttribute(
      "width",
      "600",
    );
    expect(metadata).toBe(0);
    expect(media).toBe(1);
    fireEvent.error(image);
    await screen.findByAltText("Photo could not be displayed");
  },
);
it("list thumbnail 401 removes protected list UI", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([{ ...testSetup, cover_photo: cover }]),
    ),
    http.get(`${apiUrl}/api/v1/setups/:id/photos/:photoId/thumbnail`, () =>
      HttpResponse.json({ error: "expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/my/setups");
  await screen.findByRole("button", { name: "Sign in with Google" });
  await waitFor(() =>
    expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument(),
  );
});
