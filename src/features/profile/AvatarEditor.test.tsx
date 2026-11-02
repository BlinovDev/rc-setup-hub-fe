import type { components } from "../../api/generated/schema";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { renderSetupRoute } from "../setups/testUtils";
import { testUser } from "../setups/testFixtures";
import { currentUserKey } from "../auth/queries";
const avatarPath = `/api/v1/users/${testUser.id}/avatar/11111111-1111-4111-8111-111111111111`;
let encode: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  encode = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) =>
      callback(new Blob(["normalized JPEG"], { type: "image/jpeg" })),
    );
  server.use(
    http.get(`${apiUrl}/api/v1/users/:id/avatar/:avatar`, ({ request }) => {
      expect(request.credentials).toBe("include");
      expect(request.cache).toBe("no-store");
      return HttpResponse.arrayBuffer(new ArrayBuffer(2), {
        headers: { "Content-Type": "image/jpeg" },
      });
    }),
  );
});
afterEach(() => vi.restoreAllMocks());
async function choose() {
  await screen.findByLabelText("Nickname");
  await userEvent
    .setup()
    .upload(
      screen.getByLabelText("Choose avatar file"),
      new File(["image bytes"], "avatar.png", { type: "image/png" }),
    );
  const dialog = await screen.findByRole("dialog", { name: "Adjust avatar" });
  const image = screen.getByAltText("Avatar crop preview");
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: 160,
  });
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: 100,
  });
  fireEvent.load(image);
  return { dialog, image };
}
it("crops, confirms once, saves immediately, replaces/removes with Google fallback and preserves unrelated drafts", async () => {
  let uploads = 0,
    removals = 0;
  let current: components["schemas"]["User"] = { ...testUser };
  server.use(
    http.put(`${apiUrl}/api/v1/me/avatar`, async ({ request }) => {
      uploads++;
      expect(request.credentials).toBe("include");
      expect(request.headers.get("Content-Type")).toContain(
        "multipart/form-data",
      );
      // jsdom File and Undici File are different realms. Native API/browser
      // tests own exact filename, MIME and bytes; inspect the HTTP boundary here.
      expect(await request.text()).toContain('name="file"');
      await delay(30);
      current = {
        ...testUser,
        avatar_url: avatarPath,
        has_custom_avatar: true,
      };
      return HttpResponse.json(current);
    }),
    http.delete(`${apiUrl}/api/v1/me/avatar`, () => {
      removals++;
      return HttpResponse.json({
        ...testUser,
        avatar_url: "https://google.example/fallback.jpg",
        has_custom_avatar: false,
      });
    }),
  );
  const { client } = renderSetupRoute("/settings");
  await screen.findByLabelText("Nickname");
  fireEvent.change(screen.getByLabelText("Nickname"), {
    target: { value: "Unsaved nickname" },
  });
  await choose();
  fireEvent.change(screen.getByRole("slider", { name: "Avatar zoom" }), {
    target: { value: "2" },
  });
  const confirm = screen.getByRole("button", { name: "Use this avatar" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Adjust avatar" }),
    ).not.toBeInTheDocument(),
  );
  expect(uploads).toBe(1);
  expect(encode).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Nickname")).toHaveValue("Unsaved nickname");
  expect(
    screen.getByRole("button", { name: "Replace avatar" }),
  ).toBeInTheDocument();
  expect(client.getQueryData(currentUserKey)).toMatchObject({
    has_custom_avatar: true,
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Remove avatar" }));
  expect(removals).toBe(0);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Cancel removal" }));
  expect(removals).toBe(0);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Remove avatar" }));
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Confirm removal" }));
  await screen.findByText("Avatar removed.");
  expect(removals).toBe(1);
  expect(
    screen.queryByRole("button", { name: "Remove avatar" }),
  ).not.toBeInTheDocument();
  expect(client.getQueryData(currentUserKey)).toMatchObject({
    avatar_url: "https://google.example/fallback.jpg",
    has_custom_avatar: false,
  });
  expect(screen.getByLabelText("Nickname")).toHaveValue("Unsaved nickname");
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it("Cancel never uploads and releases the preview URL", async () => {
  let writes = 0;
  server.use(
    http.put(`${apiUrl}/api/v1/me/avatar`, () => {
      writes++;
      return HttpResponse.json(testUser);
    }),
  );
  renderSetupRoute("/settings");
  await choose();
  await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));
  expect(writes).toBe(0);
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it.each([400, 403, 404, 413, 500, 503])(
  "keeps the crop for safe explicit retry on %s",
  async (status) => {
    let writes = 0;
    server.use(
      http.put(`${apiUrl}/api/v1/me/avatar`, () => {
        writes++;
        return writes === 1
          ? HttpResponse.json({ error: "SECRET" }, { status })
          : HttpResponse.json(testUser);
      }),
    );
    renderSetupRoute("/settings");
    await choose();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Use this avatar" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Adjust avatar" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry avatar upload" }));
    await waitFor(() => expect(writes).toBe(2));
  },
);
it("supports deliberate server-center confirmation when local HEIF preview is unavailable", async () => {
  let uploaded = false;
  server.use(
    http.put(`${apiUrl}/api/v1/me/avatar`, async ({ request }) => {
      expect(await request.text()).toContain('name="file"');
      uploaded = true;
      return HttpResponse.json(testUser);
    }),
  );
  renderSetupRoute("/settings");
  await screen.findByLabelText("Nickname");
  await userEvent
    .setup()
    .upload(
      screen.getByLabelText("Choose avatar file"),
      new File(["HEIF bytes"], "phone.heic", { type: "image/heic" }),
    );
  fireEvent.error(await screen.findByAltText("Avatar crop preview"));
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Upload centered avatar" }));
  await waitFor(() => expect(uploaded).toBe(true));
  expect(encode).not.toHaveBeenCalled();
});
it("rejects excessive dimensions before creating an upload", async () => {
  renderSetupRoute("/settings");
  const { image } = await choose();
  Object.defineProperty(image, "naturalWidth", {
    configurable: true,
    value: 10000,
  });
  Object.defineProperty(image, "naturalHeight", {
    configurable: true,
    value: 10000,
  });
  fireEvent.load(image);
  await screen.findByText("Choose an image of at most 50 megapixels.");
  expect(
    screen.getByRole("button", { name: "Use this avatar" }),
  ).toBeDisabled();
});
it("session expiry discards the dialog and prevents a late canvas result from uploading into another account", async () => {
  let finish: BlobCallback | undefined;
  encode.mockImplementation((callback: BlobCallback) => {
    finish = callback;
  });
  let writes = 0;
  server.use(
    http.put(`${apiUrl}/api/v1/me/avatar`, () => {
      writes++;
      return HttpResponse.json(testUser);
    }),
  );
  const { client } = renderSetupRoute("/settings");
  await choose();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Use this avatar" }));
  await act(() => client.setQueryData(currentUserKey, null));
  await screen.findByRole("button", { name: "Sign in with Google" });
  await act(() => {
    finish?.(new Blob(["late"], { type: "image/jpeg" }));
  });
  expect(writes).toBe(0);
  expect(client.getQueryData(currentUserKey)).toBeNull();
  expect(
    screen.queryByRole("dialog", { name: "Adjust avatar" }),
  ).not.toBeInTheDocument();
});
it("an avatar 401 expires the session without exposing server details", async () => {
  server.use(
    http.put(`${apiUrl}/api/v1/me/avatar`, () =>
      HttpResponse.json({ error: "SECRET" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/settings");
  await choose();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Use this avatar" }));
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
});
