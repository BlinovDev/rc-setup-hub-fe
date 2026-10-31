import { isUuid } from "../search/filters";
const key = "rc-clone-intent";
// This stores navigation intent only, never credentials or protected setup data.
export function rememberCloneTarget(id: string) {
  try {
    if (isUuid(id))
      sessionStorage.setItem(key, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* A blocked storage policy must not prevent normal sign-in. */
  }
}
export function consumeCloneTarget(): string | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("id" in value) ||
      !("at" in value)
    )
      return;
    if (
      typeof value.id === "string" &&
      isUuid(value.id) &&
      typeof value.at === "number" &&
      Date.now() - value.at >= 0 &&
      Date.now() - value.at < 10 * 60_000
    )
      return value.id;
  } catch {
    /* Invalid/expired intent is discarded; cloning always needs confirmation. */
  }
}
