export function resolveApiUrl(value: string | undefined): string {
  const url = new URL(value ?? "http://localhost:8080");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "VITE_API_URL must be an HTTP(S) origin without credentials, path, query or fragment",
    );
  }
  return url.origin;
}

export const apiUrl = resolveApiUrl(import.meta.env.VITE_API_URL);
