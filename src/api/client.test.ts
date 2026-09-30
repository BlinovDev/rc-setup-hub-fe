import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { components } from "./generated/schema";
import { createApiClient } from "./client";
import { server } from "../test/server";

const baseUrl = "http://localhost:8080";
const client = createApiClient(baseUrl);

describe("typed API client", () => {
  it("uses the configured URL and includes cookie credentials", async () => {
    server.use(
      http.get(`${baseUrl}/health`, ({ request }) => {
        expect(request.credentials).toBe("include");
        return HttpResponse.json({
          status: "ok",
        } satisfies components["schemas"]["Health"]);
      }),
    );
    const { data, response } = await client.GET("/health");
    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });

  it("enforces credentials on authenticated requests despite a caller override", async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/auth/logout`, ({ request }) => {
        expect(request.credentials).toBe("include");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { data, error, response } = await client.POST("/api/v1/auth/logout", {
      credentials: "omit",
    });
    expect(response.status).toBe(204);
    expect(data).toBeUndefined();
    expect(error).toBeUndefined();
  });

  it.each([400, 401, 404, 409, 500])(
    "preserves a %s error response",
    async (status) => {
      server.use(
        http.get(`${baseUrl}/api/v1/setups/example`, () =>
          HttpResponse.json(
            {
              error: "Request failed",
            } satisfies components["schemas"]["APIError"],
            { status },
          ),
        ),
      );
      const { data, error, response } = await client.GET(
        "/api/v1/setups/{id}",
        { params: { path: { id: "example" } } },
      );
      expect(response.status).toBe(status);
      expect(error).toEqual({ error: "Request failed" });
      expect(data).toBeUndefined();
    },
  );

  it("serializes generated request types without losing numeric zero", async () => {
    const body = {
      title: "Test setup",
      visibility: "private",
      data: { suspension: { front: { toe_deg: 0 } } },
    } satisfies components["schemas"]["CreateSetup"];
    server.use(
      http.post(`${baseUrl}/api/v1/setups`, async ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.headers.get("content-type")).toBe("application/json");
        const received: unknown = await request.json();
        expect(received).toEqual(body);
        expect(received).toHaveProperty("data.suspension.front.toe_deg", 0);
        expect(received).not.toHaveProperty("data.suspension.front.camber_deg");
        return HttpResponse.json(
          { error: "Invalid test request" },
          { status: 400 },
        );
      }),
    );
    const { response } = await client.POST("/api/v1/setups", { body });
    expect(response.status).toBe(400);
  });

  it("propagates network failures", async () => {
    server.use(http.get(`${baseUrl}/health`, () => HttpResponse.error()));
    await expect(client.GET("/health")).rejects.toThrow();
  });
});
