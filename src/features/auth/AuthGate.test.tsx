import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { AuthGate } from "./AuthGate";
import { browserNavigation } from "./navigation";
import { currentUserKey, currentUserOptions } from "./queries";

const user = {
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
  email: "driver@example.test",
  nickname: "Track driver",
  avatar_url: "https://example.test/avatar.png",
  created_at: "2026-09-30T12:00:00Z",
} satisfies components["schemas"]["User"];

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.restoreAllMocks();
});

function renderAuth() {
  const client = new QueryClient();
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>
      <AuthGate />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

function authenticated(avatar: string | null = user.avatar_url) {
  server.use(
    http.get(`${apiUrl}/api/v1/me`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json({ ...user, avatar_url: avatar });
    }),
  );
}

async function expectLogin() {
  expect(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(user.nickname)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  expect(document.querySelector("img")).toBeNull();
}

describe("authentication foundation", () => {
  it("treats 401 as unauthenticated without retries or automatic navigation", async () => {
    let requests = 0;
    const navigate = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});
    server.use(
      http.get(`${apiUrl}/api/v1/me`, () => {
        requests++;
        return HttpResponse.json({ error: "No session" }, { status: 401 });
      }),
    );
    const { client } = renderAuth();
    await expectLogin();
    expect(requests).toBe(1);
    expect(client.getQueryData(currentUserKey)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([user.avatar_url, null])(
    "renders an authenticated profile with avatar %s",
    async (avatar) => {
      authenticated(avatar);
      renderAuth();
      expect(await screen.findByText(user.nickname)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sign in with Google" }),
      ).not.toBeInTheDocument();
      const image = document.querySelector("img");
      if (avatar) {
        expect(image).toHaveAttribute("src", avatar);
        expect(image).toHaveAttribute("alt", "");
      } else {
        expect(image).toBeNull();
      }
    },
  );

  it("shows a stable initial loading state", async () => {
    server.use(
      http.get(`${apiUrl}/api/v1/me`, async () => {
        await delay(100);
        return HttpResponse.json(user);
      }),
    );
    renderAuth();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your session…",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await screen.findByText(user.nickname);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["server", "network"])(
    "shows a retryable %s failure without showing login",
    async (failure) => {
      let requests = 0;
      server.use(
        http.get(`${apiUrl}/api/v1/me`, () => {
          requests++;
          if (requests > 1) return HttpResponse.json(user);
          return failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json({ error: "Internal details" }, { status: 500 });
        }),
      );
      renderAuth();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to check your session.",
      );
      expect(screen.queryByText("Internal details")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Sign in with Google" }),
      ).not.toBeInTheDocument();
      expect(requests).toBe(1);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Retry" }));
      await screen.findByText(user.nickname);
      expect(requests).toBe(2);
    },
  );

  it("navigates the browser to the configured backend Google login URL", async () => {
    server.use(
      http.get(`${apiUrl}/api/v1/me`, () =>
        HttpResponse.json({ error: "No session" }, { status: 401 }),
      ),
    );
    const navigate = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});
    renderAuth();
    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: "Sign in with Google" }),
      );
    expect(navigate).toHaveBeenCalledExactlyOnceWith(`${apiUrl}/auth/google`);
  });

  it("signs out without reload and preserves unrelated query data", async () => {
    authenticated();
    let requests = 0;
    server.use(
      http.post(`${apiUrl}/api/v1/auth/logout`, async ({ request }) => {
        requests++;
        expect(request.credentials).toBe("include");
        await delay(100);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { client } = renderAuth();
    client.setQueryData(["unrelated"], "keep");
    await screen.findByText(user.nickname);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    await expectLogin();
    expect(requests).toBe(1);
    expect(client.getQueryData(currentUserKey)).toBeNull();
    expect(client.getQueryData(["unrelated"])).toBe("keep");
  });

  it.each([500, 401])(
    "keeps authenticated UI after logout %s and allows retry",
    async (status) => {
      authenticated();
      let requests = 0;
      server.use(
        http.post(`${apiUrl}/api/v1/auth/logout`, () => {
          requests++;
          return requests === 1
            ? HttpResponse.json({ error: "Internal details" }, { status })
            : new HttpResponse(null, { status: 204 });
        }),
      );
      const { client } = renderAuth();
      await screen.findByText(user.nickname);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Sign out" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Sign out failed.",
      );
      expect(screen.getByText(user.nickname)).toBeInTheDocument();
      expect(client.getQueryData(currentUserKey)).toEqual(user);
      expect(
        screen.queryByRole("button", { name: "Sign in with Google" }),
      ).not.toBeInTheDocument();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Try again" }));
      await expectLogin();
      expect(requests).toBe(2);
    },
  );

  it("replaces stale user and avatar with login when a later /me returns 401", async () => {
    authenticated();
    const { client } = renderAuth();
    await screen.findByText(user.nickname);
    server.use(
      http.get(`${apiUrl}/api/v1/me`, () =>
        HttpResponse.json({ error: "Expired" }, { status: 401 }),
      ),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: currentUserKey, exact: true });
    });
    await expectLogin();
    expect(client.getQueryData(currentUserKey)).toBeNull();
  });

  it("shows an unexpected background error instead of signed-out UI and can recover", async () => {
    authenticated();
    const { client } = renderAuth();
    await screen.findByText(user.nickname);
    server.use(
      http.get(`${apiUrl}/api/v1/me`, () =>
        HttpResponse.json({ error: "Internal details" }, { status: 500 }),
      ),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: currentUserKey, exact: true });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to check your session.",
    );
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    authenticated();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(user.nickname);
  });

  it("does not overwrite a successful logout with an older in-flight /me", async () => {
    authenticated();
    server.use(
      http.post(
        `${apiUrl}/api/v1/auth/logout`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { client } = renderAuth();
    await screen.findByText(user.nickname);
    let started = false;
    server.use(
      http.get(`${apiUrl}/api/v1/me`, async () => {
        started = true;
        await delay(150);
        return HttpResponse.json(user);
      }),
    );
    let refetch: Promise<void>;
    act(() => {
      refetch = client.invalidateQueries({
        queryKey: currentUserKey,
        exact: true,
      });
    });
    await waitFor(() => expect(started).toBe(true));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Sign out" }));
    await expectLogin();
    await act(async () => {
      await refetch;
    });
    expect(client.getQueryData(currentUserKey)).toBeNull();
  });

  it("resolves authentication again in a new application instance", async () => {
    let requests = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/me`, () => {
        requests++;
        return requests === 1
          ? HttpResponse.json(user)
          : HttpResponse.json({ error: "No session" }, { status: 401 });
      }),
    );
    const first = renderAuth();
    await screen.findByText(user.nickname);
    first.unmount();
    renderAuth();
    await expectLogin();
    expect(requests).toBe(2);
  });

  it("keeps auth code free of browser storage dependencies", () => {
    const sources = import.meta.glob<string>(
      ["./*.ts", "./*.tsx", "!./*.test.ts", "!./*.test.tsx"],
      { query: "?raw", import: "default", eager: true },
    );
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/);
    }
    expect(currentUserOptions.retry).toBe(false);
    expect(currentUserOptions.staleTime).toBe(60_000);
  });
});
