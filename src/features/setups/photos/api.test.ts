// @vitest-environment node
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup } from "../testFixtures";
import { uploadPhoto } from "./api";
it("uploads exact native file bytes/filename and request UUID with cookie credentials and browser-generated multipart boundary", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const photo = {
    id,
    setup_id: testSetup.id,
    width: 10,
    height: 10,
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
