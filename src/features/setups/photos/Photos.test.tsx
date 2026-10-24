import { setupControl, setupButton } from "../form/testDriver";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { components } from "../../../api/generated/schema";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup, testUser } from "../testFixtures";
import { mockActiveCatalog, renderSetupRoute } from "../testUtils";
import { detailKey, mineKey, userSetupsKey } from "../queries";
import { photosKey } from "./queries";

type Photo = components["schemas"]["SetupPhoto"];
const photo = (n: number, cover = n === 1): Photo => ({
  id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
  setup_id: testSetup.id,
  width: 600,
  height: 400,
  crop: null,
  thumbnail_revision: 0,
  thumbnail_width: 600,
  thumbnail_height: 400,
  content_type: "image/jpeg",
  is_cover: cover,
  created_at: testSetup.created_at,
  url: `/api/v1/setups/${testSetup.id}/photos/p${n}/image`,
  thumbnail_url: `/api/v1/setups/${testSetup.id}/photos/p${n}/thumbnail`,
});
const file = (name = "car.jpg") =>
  new File(["test image bytes"], name, {
    type: name.endsWith("heic") ? "image/heic" : "image/jpeg",
  });
let urls = 0;
beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => `blob:photo-${++urls}`);
      static revokeObjectURL = vi.fn();
    },
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    }),
  });
  server.use(
    http.get(
      `${apiUrl}/api/v1/setups/:id/photos/:photoId/:variant`,
      ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.cache).toBe("no-store");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      },
    ),
  );
});
afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mockSetupGallery(items: Photo[]) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({
        ...testSetup,
        cover_photo: items.find((p) => p.is_cover) ?? null,
      }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json(items),
    ),
    http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
      HttpResponse.json(testUser),
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
  );
}

it("places the shared photo toolbar before General on create and edit without submitting or resetting fields", async () => {
  mockActiveCatalog();
  mockSetupGallery([]);
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  const title = await screen.findByLabelText("Title");
  const user = userEvent.setup();
  await user.clear(title);
  await user.type(title, "Unsaved toolbar title");
  const picker = setupButton({ name: "Choose photos" });
  expect(
    picker.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await user.click(setupButton({ name: "Photo information" }));
  expect(
    screen.getByRole("region", { name: "Photo information details" }),
  ).toHaveTextContent("save immediately");
  await user.keyboard("{Escape}");
  expect(title).toHaveValue("Unsaved toolbar title");
});

it("saves a new setup once, retains partial success, and retries the same file/UUID without duplicate setup or completed upload", async () => {
  mockActiveCatalog();
  let creates = 0;
  const uploads: { name: string; key: string }[] = [];
  const stored: Photo[] = [];
  let fail = true;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      creates++;
      const body = await request.json();
      expect(body).not.toHaveProperty("photos");
      return HttpResponse.json(testSetup, { status: 201 });
    }),
    http.post(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos`,
      async ({ request }) => {
        expect(creates).toBe(1);
        expect(request.credentials).toBe("include");
        // Inspect actual multipart bytes; jsdom and Undici File realms differ.
        const multipart = await request.text();
        const name = uploads.length === 0 ? "car.jpg" : "phone.heic";
        const key = /name="request_id"\r\n\r\n([^\r]+)/.exec(multipart)?.[1];
        // File bytes/filename are checked by the native Node transport test and Chromium;
        // jsdom Files cannot be read by Undici's multipart encoder.
        uploads.push({ name: String(name), key: String(key) });
        if (name === "phone.heic" && fail)
          return HttpResponse.json({ error: "busy" }, { status: 503 });
        const p = photo(stored.length + 1);
        stored.push(p);
        return HttpResponse.json(p, { status: 201 });
      },
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json(stored),
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
  );
  renderSetupRoute("/my/setups/new");
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), "With photos");
  expect(setupControl("Photo files")).toHaveAttribute(
    "accept",
    expect.stringContaining(".heic"),
  );
  await user.upload(setupControl("Photo files"), [file(), file("phone.heic")]);
  expect(
    screen.getByText("2/10 photo slots used (saved and queued)."),
  ).toBeInTheDocument();
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByRole("button", { name: "Retry phone.heic" });
  expect(creates).toBe(1);
  expect(uploads).toHaveLength(2);
  expect(stored).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Create setup" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Uploaded and saved")).toBeInTheDocument();
  fail = false;
  await user.click(setupButton({ name: "Retry phone.heic" }));
  await waitFor(() => expect(stored).toHaveLength(2));
  await waitFor(() =>
    expect(screen.getAllByText("Uploaded and saved")).toHaveLength(2),
  );
  expect(creates).toBe(1);
  expect(uploads[1]?.key).toBe(uploads[2]?.key);
  expect(uploads.filter((u) => u.name === "car.jpg")).toHaveLength(1);
});

it("queue removal never sends DELETE and optional invalid photos do not block text saving", async () => {
  mockActiveCatalog();
  let deletes = 0,
    uploads = 0;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, () =>
      HttpResponse.json(testSetup, { status: 201 }),
    ),
    http.post(`${apiUrl}/api/v1/setups/:id/photos`, () => {
      uploads++;
      return HttpResponse.json(photo(1), { status: 201 });
    }),
    http.delete(`${apiUrl}/api/v1/setups/:id/photos/:photoId`, () => {
      deletes++;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
  );
  renderSetupRoute("/my/setups/new");
  const user = userEvent.setup({ applyAccept: false });
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), "Optional");
  await user.upload(setupControl("Photo files"), file());
  await user.click(setupButton({ name: "Remove queued car.jpg" }));
  await user.upload(
    setupControl("Photo files"),
    new File(["svg"], "bad.svg", { type: "image/svg+xml" }),
  );
  await screen.findByText(
    "Choose JPEG, PNG, WebP or HEIC/HEIF files. No files were added.",
  );
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(deletes).toBe(0);
  expect(uploads).toBe(0);
});

it("counts stored plus queued files, rejects an entire over-limit selection with no silent drop, and validates encoded size", async () => {
  const stored = Array.from({ length: 9 }, (_, i) => photo(i + 1));
  mockSetupGallery(stored);
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  const user = userEvent.setup();
  await screen.findByLabelText("Photo files");
  await waitFor(() => expect(setupControl("Photo files")).toBeEnabled());
  await user.upload(setupControl("Photo files"), [
    file("a.jpg"),
    file("b.jpg"),
  ]);
  await screen.findByText(
    "You selected 2 files, but only 1 photo slots remain. Choose fewer files; no files were added.",
  );
  expect(screen.queryByText("Queued — not uploaded")).not.toBeInTheDocument();
  const large = file("large.jpg");
  Object.defineProperty(large, "size", { value: 25 * 1024 * 1024 + 1 });
  await user.upload(setupControl("Photo files"), large);
  await screen.findByText(
    "Each photo must be at most 25 MiB. Choose smaller files; no files were added.",
  );
  await user.upload(setupControl("Photo files"), file());
  expect(
    screen.getByText("10/10 photo slots used (saved and queued)."),
  ).toBeInTheDocument();
  await user.upload(setupControl("Photo files"), file("extra.jpg"));
  await screen.findByText(
    "You selected 1 files, but only 0 photo slots remain. Choose fewer files; no files were added.",
  );
});

it("cover/delete save immediately, preserve unsaved technical values, and narrowly invalidate the affected caches", async () => {
  let stored = [photo(1), photo(2)];
  const fields: components["schemas"]["Setup"] = {
    ...testSetup,
    data: {
      ...testSetup.data,
      rear_differential: {
        type: "gear",
        model: "Saved differential",
        tuning_notes: "Saved tuning",
      },
      suspension: {
        ...testSetup.data.suspension,
        front: {
          ...testSetup.data.suspension.front,
          top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
        },
      },
    },
  };
  let deletes = 0;
  let patch: unknown;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({
        ...fields,
        cover_photo: stored.find((p) => p.is_cover) ?? null,
      }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json(stored),
    ),
    http.put(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/:photoId/cover`,
      ({ params, request }) => {
        expect(request.body).toBeNull();
        stored = stored.map((p) => ({
          ...p,
          is_cover: p.id === params.photoId,
        }));
        return HttpResponse.json(stored.find((p) => p.is_cover));
      },
    ),
    http.delete(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/:photoId`,
      ({ params }) => {
        deletes++;
        stored = stored.filter((p) => p.id !== params.photoId);
        stored = stored.map((p, i) => ({ ...p, is_cover: i === 0 }));
        return new HttpResponse(null, { status: 204 });
      },
    ),
    http.patch(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json({ ...fields, ...(patch as object) });
      },
    ),
  );
  const { client } = renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  client.setQueryData(mineKey, [testSetup]);
  client.setQueryData(userSetupsKey(testUser.id), [testSetup]);
  client.setQueryData(userSetupsKey("other-owner"), []);
  client.setQueryData(["unrelated"], "keep");
  client.setQueryData(["setups", "search", { q: "track" }], "cached");
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), " unsaved");
  fireEvent.change(setupControl("Front hex offset (mm)"), {
    target: { value: "-2,123456789" },
  });
  fireEvent.change(setupControl("Rear wheel offset (mm)"), {
    target: { value: "0" },
  });
  fireEvent.change(setupControl("Front tire model"), {
    target: { value: "Unsaved tire" },
  });

  fireEvent.change(setupControl("Front lower arm mount configuration notes"), {
    target: { value: "Unsaved front mount config" },
  });
  fireEvent.change(setupControl("Rear lower arm mount model / part number"), {
    target: { value: "Unsaved rear mount" },
  });
  fireEvent.change(setupControl("Front knuckle part number / description"), {
    target: { value: "Unsaved knuckle part" },
  });
  fireEvent.change(setupControl("Front piston notes"), {
    target: { value: "Unsaved piston" },
  });
  fireEvent.change(setupControl("Rear differential tuning notes"), {
    target: { value: "Unsaved differential tuning" },
  });
  await user.clear(setupControl("Front camber (degrees)"));
  await user.type(setupControl("Front camber (degrees)"), "-6,8");
  await user.clear(setupControl("Front top arm — Rear spacers (mm)"));
  await user.type(setupControl("Front top arm — Rear spacers (mm)"), "5,3");
  await user.click(setupButton({ name: "Make photo 2 cover" }));
  await waitFor(() => expect(stored[1]?.is_cover).toBe(true));
  await waitFor(() =>
    expect(setupButton({ name: "Make photo 1 cover" })).toBeEnabled(),
  );
  expect(setupControl("Rear differential tuning notes")).toHaveValue(
    "Unsaved differential tuning",
  );
  expect(setupControl("Title")).toHaveValue("Track setup unsaved");
  expect(setupControl("Front hex offset (mm)")).toHaveValue("-2,123456789");
  expect(setupControl("Rear wheel offset (mm)")).toHaveValue("0");
  expect(setupControl("Front tire model")).toHaveValue("Unsaved tire");

  expect(setupControl("Front lower arm mount configuration notes")).toHaveValue(
    "Unsaved front mount config",
  );
  expect(setupControl("Rear lower arm mount model / part number")).toHaveValue(
    "Unsaved rear mount",
  );
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "Unsaved knuckle part",
  );
  expect(setupControl("Front piston notes")).toHaveValue("Unsaved piston");
  expect(setupControl("Front camber (degrees)")).toHaveValue("-6,8");
  expect(setupControl("Front top arm — Rear spacers (mm)")).toHaveValue("5,3");
  expect(patch).toBeUndefined();
  expect(client.getQueryState(mineKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(userSetupsKey(testUser.id))?.isInvalidated).toBe(
    true,
  );
  expect(
    client.getQueryState(userSetupsKey("other-owner"))?.isInvalidated,
  ).toBe(false);
  expect(client.getQueryData(["unrelated"])).toBe("keep");
  await user.click(setupButton({ name: "Delete photo 2" }));
  await user.click(setupButton({ name: "Keep photo" }));
  expect(deletes).toBe(0);
  expect(setupButton({ name: "Delete photo 2" })).toHaveFocus();
  await user.click(setupButton({ name: "Delete photo 2" }));
  await user.click(setupButton({ name: "Confirm delete photo 2" }));
  await waitFor(() => expect(stored).toHaveLength(1));
  await screen.findByText("Cover photo");
  expect(stored[0]?.is_cover).toBe(true);
  await user.click(setupButton({ name: "Delete photo 1" }));
  await user.click(setupButton({ name: "Confirm delete photo 1" }));
  await waitFor(() => expect(stored).toHaveLength(0));
  expect(setupControl("Rear differential tuning notes")).toHaveValue(
    "Unsaved differential tuning",
  );
  expect(setupControl("Title")).toHaveValue("Track setup unsaved");
  expect(setupControl("Front hex offset (mm)")).toHaveValue("-2,123456789");
  expect(setupControl("Rear wheel offset (mm)")).toHaveValue("0");
  expect(setupControl("Front tire model")).toHaveValue("Unsaved tire");

  expect(setupControl("Front lower arm mount configuration notes")).toHaveValue(
    "Unsaved front mount config",
  );
  expect(setupControl("Rear lower arm mount model / part number")).toHaveValue(
    "Unsaved rear mount",
  );
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "Unsaved knuckle part",
  );
  expect(setupControl("Front piston notes")).toHaveValue("Unsaved piston");
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(patch).not.toHaveProperty("photos");
  expect(patch).toMatchObject({
    title: "Track setup unsaved",
    data: {
      running_gear: {
        front: {
          hex: { offset_mm: -2.123456789 },
          tire: { model: "Unsaved tire" },
        },
        rear: { wheel: { offset_mm: 0 } },
      },

      suspension: {
        front: {
          camber_deg: -6.8,
          toe_deg: 0,
          top_arm_spacing: { front_mm: 0, rear_mm: 5.3 },
        },
      },
    },
  });
  expect(client.getQueryData(detailKey(testSetup.id))).toBeDefined();
  expect(
    client.getQueryCache().findAll({ queryKey: photosKey(testSetup.id) }),
  ).toHaveLength(1);
});

it("gallery viewer supports close/Escape, previous/next and focus containment/restoration", async () => {
  mockSetupGallery([photo(1), photo(2)]);
  renderSetupRoute(`/setups/${testSetup.id}`);
  const user = userEvent.setup();
  const opener = await screen.findByRole("button", {
    name: "Enlarge photo 1 (cover)",
  });
  await user.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Enlarged setup photo" });
  const close = within(dialog).getByRole("button", { name: "Close photo" });
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("button", { name: "Next photo" }),
  ).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "Next photo" }));
  expect(within(dialog).getByText("Photo 2 of 2")).toBeInTheDocument();
  await user.click(
    within(dialog).getByRole("button", { name: "Previous photo" }),
  );
  expect(within(dialog).getByText("Photo 1 of 2")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(opener).toHaveFocus());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(opener);
  await user.click(setupButton({ name: "Close photo" }));
  expect(opener).toHaveFocus();
});

it.each([400, 409, 503, 500])(
  "shows per-file server error %s without automatic upload retries",
  async (status) => {
    mockSetupGallery([]);
    let writes = 0;
    server.use(
      http.post(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () => {
        writes++;
        return HttpResponse.json({ error: "rejected" }, { status });
      }),
    );
    renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
    const user = userEvent.setup();
    await waitFor(() => expect(setupControl("Photo files")).toBeEnabled());
    await user.upload(setupControl("Photo files"), file());
    await user.click(setupButton({ name: "Upload queued photos" }));
    await screen.findByRole("button", { name: "Retry car.jpg" });
    expect(writes).toBe(1);
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
  },
);
it("suppresses duplicate pending uploads and photo writes", async () => {
  mockSetupGallery([]);
  let writes = 0;
  server.use(
    http.post(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, async () => {
      writes++;
      await delay(100);
      return HttpResponse.json(photo(1), { status: 201 });
    }),
  );
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  const user = userEvent.setup();
  await waitFor(() => expect(setupControl("Photo files")).toBeEnabled());
  await user.upload(setupControl("Photo files"), file());
  await user.dblClick(setupButton({ name: "Upload queued photos" }));
  await screen.findByText("Uploaded and saved");
  expect(writes).toBe(1);
});
it("media 401 expires the session; inaccessible media does not pretend to be a zero-photo setup", async () => {
  mockSetupGallery([photo(1)]);
  server.use(
    http.get(`${apiUrl}/api/v1/setups/:id/photos/:photoId/thumbnail`, () =>
      HttpResponse.json({ error: "gone" }, { status: 404 }),
    ),
  );
  renderSetupRoute(`/setups/${testSetup.id}`);
  await screen.findByText("Photo not found or unavailable.");
  expect(
    screen.queryByAltText("No setup photo — placeholder"),
  ).not.toBeInTheDocument();
  server.use(
    http.get(`${apiUrl}/api/v1/setups/:id/photos/:photoId/image`, () =>
      HttpResponse.json({ error: "expired" }, { status: 401 }),
    ),
  );
  await userEvent
    .setup()
    .click(setupButton({ name: "Enlarge photo 1 (cover)" }));
  await screen.findByRole("button", { name: "Sign in with Google" });
});
it("revokes object URLs and gallery state after access is lost", async () => {
  let allowed = true;
  mockSetupGallery([photo(1)]);
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      allowed
        ? HttpResponse.json(testSetup)
        : HttpResponse.json({ error: "gone" }, { status: 404 }),
    ),
  );
  const { client } = renderSetupRoute(`/setups/${testSetup.id}`);
  await screen.findByRole("button", { name: "Enlarge photo 1 (cover)" });
  await screen.findByAltText("Setup photo 1");
  allowed = false;
  await act(() =>
    client.invalidateQueries({
      queryKey: detailKey(testSetup.id),
      exact: true,
    }),
  );
  await screen.findByText("Setup not found or unavailable.");
  expect(URL.revokeObjectURL).toHaveBeenCalled();
  expect(
    client
      .getQueryCache()
      .findAll({ queryKey: [...detailKey(testSetup.id), "media"] }),
  ).toHaveLength(0);
});
it("broken thumbnail decoding uses the bundled fallback", async () => {
  mockSetupGallery([photo(1)]);
  renderSetupRoute(`/setups/${testSetup.id}`);
  const image = await screen.findByAltText("Setup photo 1");
  fireEvent.error(image);
  expect(screen.getByAltText("Photo could not be displayed")).toHaveAttribute(
    "src",
    "/images/setup-photo-placeholder.webp",
  );
});

it("a stale cover failure refreshes gallery state while keeping unsaved fields", async () => {
  let galleries = 0;
  let writes = 0;
  mockSetupGallery([photo(1), photo(2)]);
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () => {
      galleries++;
      return HttpResponse.json([photo(1), photo(2)]);
    }),
    http.put(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/:photoId/cover`,
      () => {
        writes++;
        return HttpResponse.json({ error: "gone" }, { status: 404 });
      },
    ),
  );
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), " unsaved");
  fireEvent.change(setupControl("Front hex offset (mm)"), {
    target: { value: "-2,123456789" },
  });
  fireEvent.change(setupControl("Rear wheel offset (mm)"), {
    target: { value: "0" },
  });
  fireEvent.change(setupControl("Front tire model"), {
    target: { value: "Unsaved tire" },
  });

  fireEvent.change(setupControl("Front lower arm mount configuration notes"), {
    target: { value: "Unsaved front mount config" },
  });
  fireEvent.change(setupControl("Rear lower arm mount model / part number"), {
    target: { value: "Unsaved rear mount" },
  });
  fireEvent.change(setupControl("Front knuckle part number / description"), {
    target: { value: "Unsaved knuckle part" },
  });
  fireEvent.change(setupControl("Front piston notes"), {
    target: { value: "Unsaved piston" },
  });
  fireEvent.change(setupControl("Rear differential tuning notes"), {
    target: { value: "Unsaved differential tuning" },
  });
  await user.click(setupButton({ name: "Make photo 2 cover" }));
  await screen.findByText(
    "Photo or setup not found or unavailable. Reload photos.",
  );
  await waitFor(() => expect(galleries).toBeGreaterThan(1));
  expect(setupControl("Rear differential tuning notes")).toHaveValue(
    "Unsaved differential tuning",
  );
  expect(setupControl("Title")).toHaveValue("Track setup unsaved");
  expect(setupControl("Front hex offset (mm)")).toHaveValue("-2,123456789");
  expect(setupControl("Rear wheel offset (mm)")).toHaveValue("0");
  expect(setupControl("Front tire model")).toHaveValue("Unsaved tire");

  expect(setupControl("Front lower arm mount configuration notes")).toHaveValue(
    "Unsaved front mount config",
  );
  expect(setupControl("Rear lower arm mount model / part number")).toHaveValue(
    "Unsaved rear mount",
  );
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "Unsaved knuckle part",
  );
  expect(setupControl("Front piston notes")).toHaveValue("Unsaved piston");
  expect(writes).toBe(1);
});
it("changing session identity discards local queued previews and fields", async () => {
  mockActiveCatalog();
  const { client } = renderSetupRoute("/my/setups/new");
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), "Private draft");
  fireEvent.change(setupControl("Front knuckle part number / description"), {
    target: { value: "Private knuckle draft" },
  });
  fireEvent.change(setupControl("Front lower arm mount configuration notes"), {
    target: { value: "Private mount draft" },
  });
  fireEvent.change(setupControl("Rear differential tuning notes"), {
    target: { value: "Private differential tuning" },
  });
  await user.upload(setupControl("Photo files"), file());
  await screen.findByText("Queued — not uploaded");
  await act(() => {
    client.setQueryData(["auth", "me"], {
      ...testUser,
      id: "22222222-2222-4222-8222-222222222222",
      nickname: "Other driver",
    });
  });
  await waitFor(() =>
    expect(screen.queryByText("Queued — not uploaded")).not.toBeInTheDocument(),
  );
  expect(setupControl("Rear differential tuning notes")).toHaveValue("");
  expect(setupControl("Front lower arm mount configuration notes")).toHaveValue(
    "",
  );
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "",
  );
  expect(setupControl("Title")).toHaveValue("");
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it("a permitted non-owner sees gallery but no upload/cover/delete controls", async () => {
  mockSetupGallery([photo(1)]);
  const owner = "22222222-2222-4222-8222-222222222222";
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, owner_id: owner }),
    ),
    http.get(`${apiUrl}/api/v1/users/${owner}`, () =>
      HttpResponse.json({ id: owner, nickname: "Owner", avatar_url: null }),
    ),
  );
  renderSetupRoute(`/setups/${testSetup.id}`);
  await screen.findByRole("button", { name: "Enlarge photo 1 (cover)" });
  expect(screen.queryByLabelText("Photo files")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Make photo|Delete photo/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
});
