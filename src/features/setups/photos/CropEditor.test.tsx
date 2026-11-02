import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { components } from "../../../api/generated/schema";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup } from "../testFixtures";
import { mockActiveCatalog, renderSetupRoute } from "../testUtils";
type Photo = components["schemas"]["SetupPhoto"];
let photo: Photo;
let writes: components["schemas"]["PhotoCropUpdate"][];
beforeEach(() => {
  writes = [];
  photo = {
    id: "11111111-1111-4111-8111-111111111111",
    setup_id: testSetup.id,
    width: 300,
    height: 400,
    thumbnail_width: 300,
    thumbnail_height: 300,
    content_type: "image/jpeg",
    is_cover: true,
    created_at: testSetup.created_at,
    url: "/image",
    thumbnail_url: "/thumbnail?revision=1",
    thumbnail_revision: 1,
    crop: { x: 0, y: 50, size: 300 },
  };
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:normalized");
      static revokeObjectURL = vi.fn();
    },
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  mockActiveCatalog();
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, cover_photo: photo }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json([photo]),
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([{ ...testSetup, cover_photo: photo }]),
    ),
    http.get(
      `${apiUrl}/api/v1/setups/:id/photos/:photoId/:variant`,
      ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.cache).toBe("no-store");
        return new HttpResponse(new Uint8Array([1]), {
          headers: { "content-type": "image/jpeg" },
        });
      },
    ),
    http.put(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/${photo.id}/crop`,
      async ({ request }) => {
        const body =
          (await request.json()) as components["schemas"]["PhotoCropUpdate"];
        writes.push(body);
        photo = {
          ...photo,
          crop: body.crop,
          thumbnail_revision: photo.thumbnail_revision + 1,
        };
        return HttpResponse.json(photo);
      },
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
async function open() {
  const user = userEvent.setup();
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  const title = await screen.findByLabelText("Title");
  await user.clear(title);
  await user.type(title, "Unsaved crop title");
  await user.click(
    await screen.findByRole("button", { name: "Adjust thumbnail 1" }),
  );
  const image = await screen.findByAltText("Normalized photo crop preview");
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: photo.width },
    naturalHeight: { configurable: true, value: photo.height },
  });
  fireEvent.load(image);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save thumbnail" }),
    ).toBeEnabled(),
  );
  return user;
}
it("cancels without mutation, restores focus, disposes normalized media and preserves unsaved fields", async () => {
  const user = await open();
  screen.getByRole("group", { name: "Square thumbnail preview" }).focus();
  await user.keyboard("+");
  await user.keyboard("{Escape}");
  expect(writes).toEqual([]);
  expect(screen.getByLabelText("Title")).toHaveValue("Unsaved crop title");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Adjust thumbnail 1" }),
    ).toHaveFocus(),
  );
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it("applies integer gesture-keyboard coordinates and reopens the persisted frame; reset sends null with current revision", async () => {
  const user = await open();
  screen.getByRole("group", { name: "Square thumbnail preview" }).focus();
  await user.keyboard("{ArrowDown}");
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await waitFor(() =>
    expect(writes).toEqual([
      { expected_revision: 1, crop: { x: 0, y: 51, size: 300 } },
    ]),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Adjust thumbnail" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Title")).toHaveValue("Unsaved crop title");
  await user.click(screen.getByRole("button", { name: "Adjust thumbnail 1" }));
  const img = await screen.findByAltText("Normalized photo crop preview");
  Object.defineProperties(img, {
    naturalWidth: { configurable: true, value: 300 },
    naturalHeight: { configurable: true, value: 400 },
  });
  fireEvent.load(img);
  expect(screen.getByText(/Zoom 1\.00×/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Reset to center" }));
  expect(writes).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await waitFor(() =>
    expect(writes[1]).toEqual({ expected_revision: 2, crop: null }),
  );
});
it("retains failed draft, retries exactly once and requires explicit reload for stale revision", async () => {
  let conflict = true;
  server.use(
    http.put(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/${photo.id}/crop`,
      async ({ request }) => {
        writes.push(
          (await request.json()) as components["schemas"]["PhotoCropUpdate"],
        );
        return HttpResponse.json(
          { error: "failed" },
          { status: conflict ? 409 : 503 },
        );
      },
    ),
  );
  const user = await open();
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await screen.findByRole("button", { name: "Reload crop" });
  expect(screen.getByRole("button", { name: "Save thumbnail" })).toBeDisabled();
  expect(writes).toHaveLength(1);
  photo = { ...photo, thumbnail_revision: 2, crop: { x: 0, y: 20, size: 250 } };
  await user.click(screen.getByRole("button", { name: "Reload crop" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save thumbnail" }),
    ).toBeEnabled(),
  );
  conflict = false;
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await user.click(await screen.findByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(writes).toHaveLength(3));
  expect(writes[2]).toEqual(writes[1]);
  expect(writes[1]?.expected_revision).toBe(2);
  expect(photo.crop).toEqual({ x: 0, y: 20, size: 250 });
});
it("removes the normalized preview and blocks apply when a crop races with deletion", async () => {
  let deleted = false;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json(deleted ? [] : [photo]),
    ),
    http.put(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos/${photo.id}/crop`,
      () => {
        deleted = true;
        return HttpResponse.json({ error: "deleted" }, { status: 404 });
      },
    ),
  );
  const user = await open();
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await screen.findByText(
    "Photo was deleted or is unavailable. Close the editor and reload photos.",
  );
  expect(
    screen.queryByAltText("Normalized photo crop preview"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save thumbnail" })).toBeDisabled();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Choose photos" })).toHaveFocus(),
  );
});

it("supports keyboard movement and zoom as an accessible gesture alternative", async () => {
  const user = await open();
  const preview = screen.getByRole("group", {
    name: "Square thumbnail preview",
  });
  preview.focus();
  await user.keyboard("+");
  expect(screen.getByText(/Zoom 1\.25×/)).toBeVisible();
  await user.keyboard("{ArrowDown}");
  expect(preview).toHaveFocus();
});

it("keeps reset as an unsaved draft until Apply; cancel and reopen retain the old frame", async () => {
  const user = await open();
  await user.click(screen.getByRole("button", { name: "Reset to center" }));
  expect(writes).toEqual([]);
  expect(screen.getByText(/Zoom 1\.00×/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Adjust thumbnail 1" }));
  await screen.findByAltText("Normalized photo crop preview");
  expect(writes).toEqual([]);
});
it("preserves historical extreme saved crops until explicitly reset", async () => {
  photo.crop = { x: 20, y: 60, size: 1 };
  const user = await open();
  expect(screen.getByText(/saved crop is tighter/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save thumbnail" }));
  await waitFor(() =>
    expect(writes[0]?.crop).toEqual({ x: 20, y: 60, size: 1 }),
  );
});
