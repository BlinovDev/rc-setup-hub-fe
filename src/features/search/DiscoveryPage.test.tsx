import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup } from "../setups/testFixtures";
import {
  activeBrand,
  activeModel,
  mockActiveCatalog,
  renderSetupRoute,
} from "../setups/testUtils";
const brandB = "c61393b6-daa0-4eb8-923c-57aedbb46a60";
const item = {
  id: testSetup.id,
  title: "Public track",
  visibility: "public",
  chassis_model_id: testSetup.chassis_model_id,
  chassis: testSetup.chassis,
  owner: {
    id: testSetup.owner_id,
    nickname: "Public driver",
    avatar_url: "https://example.test/avatar.png",
  },
  created_at: testSetup.created_at,
  updated_at: testSetup.updated_at,
  schema_version: 1,
} satisfies components["schemas"]["SetupSearchItem"];
const second = {
  ...item,
  id: brandB,
  title: "Custom build",
  chassis: null,
  chassis_model_id: null,
};
const searchUrl = `${apiUrl}/api/v1/setups/search`;
beforeEach(() => mockActiveCatalog());
function emptySearch() {
  server.use(
    http.get(searchUrl, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
  );
}
it("reconstructs URL filters and renders historical cards without N+1 detail requests", async () => {
  let detailCalls = 0;
  server.use(
    http.get(searchUrl, ({ request }) => {
      expect(request.credentials).toBe("include");
      expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
        q: "rd2",
        brand_id: activeBrand,
        model_id: activeModel,
        limit: "20",
      });
      return HttpResponse.json({ items: [item, second], next_cursor: null });
    }),
    http.get(`${apiUrl}/api/v1/setups/:id`, () => {
      detailCalls++;
      return HttpResponse.json(testSetup);
    }),
  );
  renderSetupRoute(`/?q=rd2&brand_id=${activeBrand}&model_id=${activeModel}`);
  await screen.findByText(item.title);
  await screen.findByRole("option", { name: "RMX" });
  expect(
    screen.getByRole("textbox", { name: "Title or owner nickname" }),
  ).toHaveValue("rd2");
  expect(screen.getByRole("combobox", { name: "Brand" })).toHaveValue(
    activeBrand,
  );
  expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue(
    activeModel,
  );
  expect(screen.getByText("Historical Yokomo RD2.0")).toBeInTheDocument();
  expect(screen.getByText("Custom / not listed")).toBeInTheDocument();
  expect(screen.getAllByText("Public driver")).toHaveLength(2);
  expect(screen.getByRole("link", { name: item.title })).toHaveAttribute(
    "href",
    `/setups/${item.id}`,
  );
  expect(
    screen.queryByRole("option", { name: "Custom / not listed" }),
  ).not.toBeInTheDocument();
  expect(detailCalls).toBe(0);
});
it("paginates once per cursor, preserves page one while loading, and resets on URL text changes", async () => {
  const requests: Record<string, string>[] = [];
  const third = { ...item, id: activeBrand, title: "Third setup" };
  const fourth = { ...item, id: activeModel, title: "Fourth setup" };
  server.use(
    http.get(searchUrl, async ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      requests.push(params);
      if (params.cursor) {
        await delay(100);
        return HttpResponse.json({ items: [third, fourth], next_cursor: null });
      }
      return HttpResponse.json({
        items: [item, second],
        next_cursor: "opaque-2",
      });
    }),
  );
  const { router } = renderSetupRoute(
    `/?q=rd2&brand_id=${activeBrand}&model_id=${activeModel}`,
  );
  await screen.findByText(item.title);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Load more" }));
  expect(screen.getByText(item.title)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Loading more…" })).toBeDisabled();
  await screen.findByText(fourth.title);
  expect(screen.getAllByText(third.title)).toHaveLength(1);
  expect(screen.getAllByText(fourth.title)).toHaveLength(1);
  expect(screen.getAllByText(item.title)).toHaveLength(1);
  expect(screen.getAllByText(second.title)).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Load more" }),
  ).not.toBeInTheDocument();
  expect(requests).toEqual([
    { q: "rd2", brand_id: activeBrand, model_id: activeModel, limit: "20" },
    {
      q: "rd2",
      brand_id: activeBrand,
      model_id: activeModel,
      limit: "20",
      cursor: "opaque-2",
    },
  ]);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "  new  " },
  });
  expect(requests).toHaveLength(2);
  await events.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(router.state.location.search).toContain("q=new");
  expect(requests[2]).toEqual({
    q: "new",
    brand_id: activeBrand,
    model_id: activeModel,
    limit: "20",
  });
  expect(screen.queryByText(fourth.title)).not.toBeInTheDocument();
});
it("changing or clearing brand immediately clears model and URL before requesting", async () => {
  const requests: Record<string, string>[] = [];
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
      HttpResponse.json([
        { id: activeBrand, name: "MST" },
        { id: brandB, name: "Yokomo" },
      ]),
    ),
    http.get(`${apiUrl}/api/v1/chassis/brands/${brandB}/models`, () =>
      HttpResponse.json([]),
    ),
    http.get(searchUrl, ({ request }) => {
      requests.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json({ items: [], next_cursor: null });
    }),
  );
  const { router } = renderSetupRoute(
    `/?brand_id=${activeBrand}&model_id=${activeModel}`,
  );
  await screen.findByRole("option", { name: "Yokomo" });
  fireEvent.change(screen.getByRole("combobox", { name: "Brand" }), {
    target: { value: brandB },
  });
  expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue("");
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(router.state.location.search).toBe(`?brand_id=${brandB}`);
  expect(requests[1]).toEqual({ brand_id: brandB, limit: "20" });
  fireEvent.change(screen.getByRole("combobox", { name: "Brand" }), {
    target: { value: "" },
  });
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(router.state.location.search).toBe("");
  expect(requests[2]).toEqual({ limit: "20" });
});
it("sets the selected model in the URL and removes blank search text", async () => {
  emptySearch();
  const { router } = renderSetupRoute(`/?q=old&brand_id=${activeBrand}`);
  await screen.findByRole("option", { name: "RMX" });
  fireEvent.change(screen.getByRole("combobox", { name: "Model" }), {
    target: { value: activeModel },
  });
  expect(router.state.location.search).toContain(`model_id=${activeModel}`);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
  await userEvent.setup().click(screen.getByRole("button", { name: "Search" }));
  expect(router.state.location.search).toBe(
    `?brand_id=${activeBrand}&model_id=${activeModel}`,
  );
});
it.each(["brand_id=bad", "model_id=bad", `q=${"a".repeat(101)}`, "q=%00"])(
  "invalid URL %s makes no search/catalog requests",
  async (params) => {
    let calls = 0;
    server.use(
      http.get(searchUrl, () => {
        calls++;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
      http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
        calls++;
        return HttpResponse.json([]);
      }),
    );
    renderSetupRoute(`/?${params}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid search filters",
    );
    expect(calls).toBe(0);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reset filters" }));
    await screen.findByText("No public setups match these filters.");
  },
);
it.each(["a".repeat(101), "invalid\0text"])(
  "rejects invalid input without a search request",
  async (text) => {
    let calls = 0;
    server.use(
      http.get(searchUrl, () => {
        calls++;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    renderSetupRoute("/");
    await screen.findByText("No public setups match these filters.");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use at most 100 characters",
    );
    expect(calls).toBe(1);
  },
);
it("shows initial loading and empty results", async () => {
  server.use(
    http.get(searchUrl, async () => {
      await delay(100);
      return HttpResponse.json({ items: [], next_cursor: null });
    }),
  );
  renderSetupRoute("/");
  await screen.findByText("Loading public setups…");
  await screen.findByText("No public setups match these filters.");
});
it.each([400, 500, "network"])(
  "first page %s is retryable and never treated as logout",
  async (failure) => {
    let calls = 0;
    server.use(
      http.get(searchUrl, () => {
        calls++;
        return calls > 1
          ? HttpResponse.json({ items: [item], next_cursor: null })
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json(
                { error: "Internal secret" },
                { status: Number(failure) },
              );
      }),
    );
    renderSetupRoute("/");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      failure === 400 ? "Invalid search" : "Unable to load public setups",
    );
    expect(screen.queryByText("Internal secret")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry search" }));
    await screen.findByText(item.title);
    expect(calls).toBe(2);
  },
);
it.each([500, "network"])(
  "retains page one after next-page %s failure and retries cursor",
  async (failure) => {
    let nextCalls = 0;
    server.use(
      http.get(searchUrl, ({ request }) => {
        if (!new URL(request.url).searchParams.has("cursor"))
          return HttpResponse.json({ items: [item], next_cursor: "next" });
        nextCalls++;
        return nextCalls > 1
          ? HttpResponse.json({ items: [second], next_cursor: null })
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json({ error: "Internal" }, { status: 500 });
      }),
    );
    renderSetupRoute("/");
    await screen.findByText(item.title);
    const events = userEvent.setup();
    await events.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Unable to load more setups. Please retry.");
    expect(screen.getByText(item.title)).toBeInTheDocument();
    await events.click(screen.getByRole("button", { name: "Retry load more" }));
    await screen.findByText(second.title);
    expect(nextCalls).toBe(2);
  },
);
it("search 401 clears the existing auth state", async () => {
  server.use(
    http.get(searchUrl, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/");
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("keeps a bookmarked historical filter without forcing it into active catalog options", async () => {
  server.use(
    http.get(
      `${apiUrl}/api/v1/chassis/brands/${testSetup.chassis.brand_id}/models`,
      () => HttpResponse.json({ error: "Unavailable" }, { status: 404 }),
    ),
    http.get(searchUrl, ({ request }) => {
      expect(new URL(request.url).searchParams.get("model_id")).toBe(
        testSetup.chassis_model_id,
      );
      return HttpResponse.json({ items: [item], next_cursor: null });
    }),
  );
  renderSetupRoute(
    `/?brand_id=${testSetup.chassis.brand_id}&model_id=${testSetup.chassis_model_id}`,
  );
  await screen.findByText(item.title);
  await screen.findByText(/Selected brand unavailable/);
  expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue(
    testSetup.chassis_model_id,
  );
});
it("catalog 401 clears auth without a separate logged-out state", async () => {
  emptySearch();
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/");
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
