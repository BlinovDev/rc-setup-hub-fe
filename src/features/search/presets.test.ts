import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { searchSetups } from "./api";
import { readFilters, filterParams } from "./filters";
import { visibleSetups } from "../compare/api";

const model = "11111111-1111-4111-8111-111111111111";
it.each(["mine", "friends"] as const)(
  "sends %s and chassis filters to the server on every page",
  async (scope) => {
    const filters = readFilters(
      new URLSearchParams(`scope=${scope}&model_id=${model}&q=carpet`),
    );
    expect(filters.valid).toBe(true);
    expect(readFilters(filterParams(filters.filters)).filters).toEqual(
      filters.filters,
    );
    const seen: string[] = [];
    server.use(
      http.get(`${apiUrl}/api/v1/setups/visible`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("scope")).toBe(scope);
        expect(query.get("model_id")).toBe(model);
        expect(query.get("q")).toBe("carpet");
        expect(request.credentials).toBe("include");
        expect(request.cache).toBe("no-store");
        seen.push(query.get("cursor") ?? "first");
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    const signal = new AbortController().signal;
    await searchSetups(filters.filters, null, signal);
    await searchSetups(filters.filters, "next", signal);
    await visibleSetups("carpet", "comparison-next", signal, model, scope);
    expect(seen).toEqual(["first", "next", "comparison-next"]);
  },
);
it("keeps default discovery public-only", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/search`, ({ request }) => {
      expect(new URL(request.url).searchParams.has("scope")).toBe(false);
      return HttpResponse.json({ items: [], next_cursor: null });
    }),
  );
  await searchSetups(
    readFilters(new URLSearchParams()).filters,
    null,
    new AbortController().signal,
  );
});
it.each(["", "unknown", "MINE"])("rejects unsupported scope %s", (scope) => {
  expect(readFilters(new URLSearchParams({ scope })).valid).toBe(false);
});
