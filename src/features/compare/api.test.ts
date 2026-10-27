import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "../setups/testFixtures";
import { compareSetups, visibleSetups } from "./api";
it("uses the bounded visibility endpoint, literal q, opaque cursor, no-store and credentialed GET", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/visible`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      expect(Object.fromEntries(p)).toEqual({
        limit: "20",
        q: "100%_pilot",
        cursor: "opaque/+",
      });
      expect(request.credentials).toBe("include");
      expect(request.cache).toBe("no-store");
      return HttpResponse.json({ items: [], next_cursor: null });
    }),
  );
  expect(
    await visibleSetups("100%_pilot", "opaque/+", new AbortController().signal),
  ).toEqual({ items: [], next_cursor: null });
});
it.each([400, 401, 404, 414, 429, 500])(
  "rejects candidate status %s rather than returning a misleading empty list",
  async (status) => {
    server.use(
      http.get(
        `${apiUrl}/api/v1/setups/visible`,
        () => new HttpResponse(null, { status }),
      ),
    );
    await expect(
      visibleSetups("", null, new AbortController().signal),
    ).rejects.toMatchObject({ status });
  },
);
it.each([
  {},
  { left: testSetup },
  { left: testSetup, right: testSetup },
  {
    left: { ...testSetup, visibility: "private" },
    right: { ...testSetup, id: testUser.id },
  },
])(
  "rejects partial, mismatched and non-public guest responses without usable data",
  async (payload) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/compare`, () =>
        HttpResponse.json(payload),
      ),
    );
    await expect(
      compareSetups(
        testSetup.id,
        testUser.id,
        true,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 404 });
  },
);
