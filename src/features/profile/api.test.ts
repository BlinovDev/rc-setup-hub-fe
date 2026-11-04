// @vitest-environment node
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../../test/server";
import { apiUrl } from "../../api/config";
import { testUser } from "../setups/testFixtures";
import { uploadAvatar, removeAvatar, ProfileError } from "./api";
it.each([
  ["avatar.jpg", "image/jpeg"],
  ["phone.heic", "image/heic"],
])(
  "uploads only the confirmed file, preserving bytes/MIME for %s",
  async (name, type) => {
    const bytes = new Uint8Array([255, 216, 255, 0]);
    server.use(
      http.put(`${apiUrl}/api/v1/me/avatar`, async ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.headers.get("Content-Type")).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        const form = await request.formData();
        expect([...form.keys()]).toEqual(["file"]);
        const file = form.get("file") as File;
        expect(file.name).toBe(name);
        expect(file.type).toBe(type);
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
        return HttpResponse.json(testUser);
      }),
    );
    expect(await uploadAvatar(new File([bytes], name!, { type }))).toEqual(
      testUser,
    );
  },
);
it("removal uses the authenticated owner endpoint with no target owner input", async () => {
  server.use(
    http.delete(`${apiUrl}/api/v1/me/avatar`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json(testUser);
    }),
  );
  expect(await removeAvatar()).toEqual(testUser);
});
it.each([400, 401, 403, 404, 413, 500, 503])(
  "keeps avatar %s errors generic",
  async (status) => {
    server.use(
      http.put(`${apiUrl}/api/v1/me/avatar`, () =>
        HttpResponse.json({ error: "secret" }, { status }),
      ),
    );
    await expect(
      uploadAvatar(new File(["image"], "avatar.jpg")),
    ).rejects.toEqual(new ProfileError(status));
  },
);
