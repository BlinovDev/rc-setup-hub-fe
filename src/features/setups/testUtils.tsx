import { afterEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { apiUrl } from "../../api/config";
import { routes } from "../../app/router";
import { server } from "../../test/server";
import { testUser } from "./testFixtures";

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

export function renderSetupRoute(path: string) {
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () => HttpResponse.json(testUser)),
  );
  const client = new QueryClient();
  clients.push(client);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router, ...view };
}
export function mockActiveCatalog() {
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
      HttpResponse.json([{ id: activeBrand, name: "MST" }]),
    ),
    http.get(`${apiUrl}/api/v1/chassis/brands/${activeBrand}/models`, () =>
      HttpResponse.json([{ id: activeModel, name: "RMX" }]),
    ),
  );
}
export const activeBrand = "c61393b6-daa0-4eb8-923c-57aedbb46a50";
export const activeModel = "c61393b6-daa0-4eb8-923c-57aedbb46a51";
