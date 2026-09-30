import { expect, it } from "vitest";
import { filterParams, readFilters } from "./filters";
import { activeBrand, activeModel } from "../setups/testUtils";
it("normalizes text and round trips filters without exposing a cursor", () => {
  const result = readFilters(
    new URLSearchParams(
      `q=%20rd2%20&brand_id=${activeBrand}&model_id=${activeModel}&cursor=secret`,
    ),
  );
  expect(result.valid).toBe(true);
  expect(result.filters).toEqual({
    q: "rd2",
    brandId: activeBrand,
    modelId: activeModel,
    limit: 20,
  });
  expect(filterParams(result.filters).toString()).toBe(
    `q=rd2&brand_id=${activeBrand}&model_id=${activeModel}`,
  );
  expect(
    filterParams({ q: "", brandId: null, modelId: null, limit: 20 }).toString(),
  ).toBe("");
});
it.each(["brand_id=bad", "model_id=bad", `q=${"a".repeat(101)}`, "q=%00"])(
  "rejects untrusted URL %s",
  (value) => {
    expect(readFilters(new URLSearchParams(value)).valid).toBe(false);
  },
);
