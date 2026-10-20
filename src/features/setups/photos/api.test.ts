// @vitest-environment node
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup } from "../testFixtures";
import { photoError, uploadPhoto } from "./api";
it("uploads exact native file bytes/filename and request UUID with cookie credentials and browser-generated multipart boundary", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const photo = {
    id,
    setup_id: testSetup.id,
    width: 10,
    height: 10,
    crop: null,
    thumbnail_revision: 0,
    thumbnail_width: 10,
    thumbnail_height: 10,
    content_type: "image/jpeg",
    is_cover: true,
    created_at: testSetup.created_at,
    url: "/image",
    thumbnail_url: "/thumbnail",
  };
  let calls = 0;
  server.use(
    http.post(
      `${apiUrl}/api/v1/setups/${testSetup.id}/photos`,
      async ({ request }) => {
        calls++;
        expect(request.credentials).toBe("include");
        expect(request.headers.get("Content-Type")).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        const form = await request.formData();
        expect(form.get("request_id")).toBe(id);
        const uploaded = form.get("file") as File;
        expect(uploaded.name).toBe("phone.heic");
        expect(uploaded.type).toBe("image/heic");
        expect(await uploaded.text()).toBe("native image bytes");
        return HttpResponse.json(photo, { status: 201 });
      },
    ),
  );
  const file = new File(["native image bytes"], "phone.heic", {
    type: "image/heic",
  });
  expect(await uploadPhoto(testSetup.id, file, id)).toEqual(photo);
  expect(calls).toBe(1);
});

it.each([
  ["IMG_4144.jpeg", "image/jpeg", new Uint8Array([255, 216, 255, 0])],
  [
    "IMG_4144.jpeg",
    "image/heif",
    new Uint8Array([
      0, 0, 0, 16, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0,
    ]),
  ],
  [
    "IMG_4144.heic",
    "application/octet-stream",
    new Uint8Array([255, 216, 255, 0]),
  ],
])(
  "preserves iOS filename/MIME/bytes for %s (%s)",
  async (name, type, bytes) => {
    server.use(
      http.post(
        `${apiUrl}/api/v1/setups/${testSetup.id}/photos`,
        async ({ request }) => {
          const file = (await request.formData()).get("file") as File;
          expect(file.name).toBe(name);
          expect(file.type).toBe(type);
          expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
          return HttpResponse.json({}, { status: 201 });
        },
      ),
    );
    await uploadPhoto(
      testSetup.id,
      new File([bytes], name, { type }),
      "11111111-1111-4111-8111-111111111111",
    );
  },
);

it.each([
  [400, "invalid photo: unsupported image format", "Unsupported photo format"],
  [400, "invalid photo: image could not be decoded", "could not be decoded"],
  [
    400,
    "invalid photo: image must be at most 50 megapixels",
    "exceeds 50 megapixels",
  ],
  [400, "file exceeds 25 MiB or is empty", "at most 25 MiB"],
  [400, "a setup may have at most 10 photos", "already has 10 photos"],
  [400, "private database error", "Photo rejected"],
  [400, "__proto__", "Photo rejected"],
  [400, "constructor", "Photo rejected"],
  [413, "proxy details", "server rejected the upload size"],
  [500, "private filesystem details", "Retry this file"],
  [503, "private process details", "busy"],
])(
  "maps upload %s validation safely (%s)",
  async (status, message, expected) => {
    server.use(
      http.post(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
        HttpResponse.json({ error: message }, { status }),
      ),
    );
    try {
      await uploadPhoto(
        testSetup.id,
        new File(["bytes"], "phone.jpeg", { type: "image/jpeg" }),
        "11111111-1111-4111-8111-111111111111",
      );
      expect.fail("upload should fail");
    } catch (error) {
      expect(photoError(error)).toContain(expected);
      expect(photoError(error)).not.toContain("private");
    }
  },
);
