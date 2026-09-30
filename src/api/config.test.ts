import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./config";

describe("API configuration", () => {
  it("defaults to the local backend", () => {
    expect(resolveApiUrl(undefined)).toBe("http://localhost:8080");
  });
  it("accepts a configured HTTP(S) origin", () => {
    expect(resolveApiUrl("https://api.example.test/")).toBe(
      "https://api.example.test",
    );
  });
  it.each([
    "",
    "invalid",
    "ftp://example.test",
    "https://user:secret@example.test",
    "https://example.test/api",
    "https://example.test?q=1",
    "https://example.test/#fragment",
  ])("rejects invalid configuration: %s", (value) => {
    expect(() => resolveApiUrl(value)).toThrow();
  });
});
