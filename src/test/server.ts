import { http, HttpResponse } from "msw";
import { apiUrl } from "../api/config";
import { setupServer } from "msw/node";

// Each API-boundary test registers only the handlers it needs.
export const server = setupServer(
  http.get(`${apiUrl}/api/v1/setups/:id/photos`, () => HttpResponse.json([])),
);
