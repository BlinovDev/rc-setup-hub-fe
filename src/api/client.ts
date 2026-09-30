import createClient from "openapi-fetch";
import type { paths } from "./generated/schema";
import { apiUrl } from "./config";

export function createApiClient(baseUrl = apiUrl) {
  return createClient<paths>({
    baseUrl,
    credentials: "include",
    // Enforce cookie credentials even if a caller supplies a different option.
    fetch: (request) =>
      globalThis.fetch(new Request(request, { credentials: "include" })),
  });
}

export const apiClient = createApiClient();
