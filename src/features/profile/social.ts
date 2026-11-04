export type SocialPlatform = "instagram" | "tiktok" | "youtube";

// Friendly validation mirrors the contract; the backend remains authoritative.
// Only profile-shaped URLs are accepted, never short links/redirect endpoints.
export function socialUrl(
  platform: SocialPlatform,
  value: string,
): string | null {
  const text = value.trim();
  if (!text) return null;
  if (new TextEncoder().encode(text).length > 2048 || /[\\%\r\n\t]/.test(text))
    throw new Error("Use a platform profile URL of at most 2048 bytes.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Enter a valid HTTPS profile URL.");
  }
  const host = url.host.toLowerCase();
  const path = url.pathname.replace(/\/$/, "");
  // Check the original path too: URL() normalizes dot segments/backslashes.
  const rawPath = text
    .slice(text.indexOf("://") + 3)
    .replace(/^[^/]+/, "")
    .replace(/\/$/, "");
  const correctHost =
    host === `${platform}.com` || host === `www.${platform}.com`;
  const paths = {
    instagram: /^\/[A-Za-z0-9._]{1,30}$/,
    tiktok: /^\/@[A-Za-z0-9._]{1,24}$/,
    youtube:
      /^\/(?:@[\p{L}\p{N}._-]{1,100}|(?:channel|c|user)\/[A-Za-z0-9._-]{1,100})$/u,
  };
  if (
    url.protocol !== "https:" ||
    !correctHost ||
    url.username ||
    url.password ||
    /[?#]/.test(text) ||
    rawPath !== path ||
    !paths[platform].test(path) ||
    (platform === "instagram" &&
      [
        "accounts",
        "explore",
        "direct",
        "p",
        "reel",
        "reels",
        "stories",
        "about",
        "redirect",
        "l.php",
        ".",
        "..",
      ].includes(path.slice(1).toLowerCase()))
  )
    throw new Error(
      `Use an HTTPS ${platform === "youtube" ? "YouTube" : platform === "tiktok" ? "TikTok" : "Instagram"} profile URL without tracking parameters or redirects.`,
    );
  // URL.host silently drops :443; explicit ports are outside the API contract.
  if (/^https:\/\/[^/]*:/.test(text))
    throw new Error("Remove the port from the profile URL.");
  return `https://${host}${path}`;
}

export function safeSocialUrl(platform: SocialPlatform, value?: string | null) {
  try {
    return socialUrl(platform, value ?? "");
  } catch {
    return null;
  }
}
