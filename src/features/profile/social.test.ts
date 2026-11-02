import { expect, it } from "vitest";
import { safeSocialUrl, socialUrl } from "./social";
it.each([
  [
    "instagram",
    " https://www.instagram.com/driver/ ",
    "https://www.instagram.com/driver",
  ],
  [
    "tiktok",
    "https://tiktok.com/@driver.name",
    "https://tiktok.com/@driver.name",
  ],
  ["youtube", "https://youtube.com/@driver", "https://youtube.com/@driver"],
  [
    "youtube",
    "https://youtube.com/channel/UC123",
    "https://youtube.com/channel/UC123",
  ],
  [
    "youtube",
    "https://youtube.com/user/driver",
    "https://youtube.com/user/driver",
  ],
] as const)("validates %s profile URLs", (platform, value, want) =>
  expect(socialUrl(platform, value)).toBe(want),
);
it.each([
  "javascript:alert(1)",
  "data:image/svg+xml,evil",
  "http://instagram.com/driver",
  "https://instagram.com.evil.test/driver",
  "https://user@instagram.com/driver",
  "https://instagram.com:443/driver",
  "https://instagram.com/driver?next=evil",
  "https://instagram.com/l.php",
  "https://instagram.com/accounts",
  "https://instagram.com/%64river",
  "https://instagram.com/driver/../accounts",
  "https://instagram.com/driver#",
  "https://instagram.com/driver\\evil",
  "https://instagram.com/" + "a".repeat(2048),
])("rejects unsafe social URL %s", (value) => {
  expect(() => socialUrl("instagram", value)).toThrow();
  expect(safeSocialUrl("instagram", value)).toBeNull();
});
it("clears empty links and refuses shortened/wrong-platform URLs", () => {
  expect(socialUrl("instagram", " ")).toBeNull();
  expect(safeSocialUrl("tiktok", "https://vm.tiktok.com/abc")).toBeNull();
  expect(
    safeSocialUrl("youtube", "https://youtube.com/redirect?q=evil"),
  ).toBeNull();
  expect(safeSocialUrl("instagram", "https://youtube.com/@driver")).toBeNull();
});
