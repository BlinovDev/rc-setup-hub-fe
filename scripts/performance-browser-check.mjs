import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import assert from "node:assert/strict";

// Production bundle, deterministic 120ms API latency. This measures the client
// request waterfall and visible data, not PostgreSQL or production network speed.
const origin = "http://127.0.0.1:5188";
const api = "http://127.0.0.1:8088";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = {
  id: id(100),
  nickname: "Performance driver",
  email: "perf@example.test",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
};
const setups = Array.from({ length: 20 }, (_, i) => ({
  id: id(i + 1),
  owner_id: user.id,
  title: `Performance setup ${i + 1}`,
  visibility: "public",
  moderation_status: "approved",
  schema_version: 1,
  chassis_model_id: null,
  chassis: null,
  notes: null,
  data: { suspension: { front: { camber_deg: 0 } } },
  created_at: user.created_at,
  updated_at: user.created_at,
  cover_photo: {
    id: id(200 + i),
    setup_id: id(i + 1),
    width: 1,
    height: 1,
    thumbnail_width: 1,
    thumbnail_height: 1,
    is_cover: true,
    content_type: "image/jpeg",
    created_at: user.created_at,
    crop: null,
    thumbnail_revision: 0,
    url: `/api/v1/setups/${id(i + 1)}/photos/${id(200 + i)}/image`,
    thumbnail_url: `/api/v1/setups/${id(i + 1)}/photos/${id(200 + i)}/thumbnail`,
  },
}));
const summary = {
  items: setups.map((s) => ({ ...s, owner: user })),
  next_cursor: null,
};
const reports = [];
let preview, browser;
async function runBuild() {
  const build = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    {
      env: { ...process.env, VITE_API_URL: api },
      stdio: "inherit",
    },
  );
  const [code] = await once(build, "exit");
  assert.equal(code, 0, "production build failed");
}
try {
  await runBuild();
  preview = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "5188",
      "--strictPort",
    ],
    { stdio: "inherit" },
  );
  for (let i = 0; ; i++) {
    try {
      await fetch(origin);
      break;
    } catch {
      assert(i < 100 && preview.exitCode === null, "preview failed to start");
      await delay(100);
    }
  }
  browser = await chromium.launch();
  for (const width of [390, 1280]) {
    for (const scenario of [
      { name: "home", path: "/", endpoint: "/api/v1/setups/search" },
      { name: "my-setups", path: "/my/setups", endpoint: "/api/v1/me/setups" },
      {
        name: "compare-selector",
        path: "/compare",
        endpoint: "/api/v1/setups/visible",
      },
      {
        name: "compare-data",
        path: `/compare?left_id=${id(1)}&right_id=${id(2)}`,
        endpoint: "/api/v1/setups/compare",
      },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let requests = [];
      await page.route(`${api}/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        requests.push(path);
        await delay(120);
        let body;
        if (path === "/api/v1/me") body = user;
        else if (path === "/api/v1/me/setups") body = setups;
        else if (
          ["/api/v1/setups/search", "/api/v1/setups/visible"].includes(path)
        )
          body = summary;
        else if (path === "/api/v1/setups/compare")
          body = { left: setups[0], right: setups[1] };
        else if (path === "/api/v1/chassis/brands") body = [];
        else if (path.endsWith("/thumbnail")) {
          await route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>',
          });
          return;
        } else {
          errors.push(`Unexpected request: ${path}`);
          await route.fulfill({ status: 500 });
          return;
        }
        await route.fulfill({ json: body });
      });
      for (const mode of ["cold", "reload"]) {
        requests = [];
        const start = performance.now();
        await page.goto(origin + scenario.path);
        if (scenario.name === "compare-data")
          await page
            .getByRole("heading", { name: "Setup comparison", exact: true })
            .waitFor();
        else if (scenario.name === "compare-selector")
          await page
            .getByRole("button", {
              name: "Select Performance setup 1 as first setup",
              exact: true,
            })
            .waitFor();
        else
          await page
            .getByRole("link", { name: "Performance setup 1", exact: true })
            .waitFor();
        const dataMs = performance.now() - start;
        await page
          .locator('img[alt="Cover of Performance setup 1"]')
          .first()
          .waitFor();
        await page.waitForFunction(() => {
          const image = document.querySelector(
            'img[alt="Cover of Performance setup 1"]',
          );
          return image?.complete && image.naturalWidth > 0;
        });
        const coverMs = performance.now() - start;
        await page.waitForLoadState("networkidle");
        assert.equal(
          requests.filter((p) => p === scenario.endpoint).length,
          1,
          "duplicate page data request",
        );
        assert.equal(
          requests.filter((p) => p === "/api/v1/me").length,
          1,
          "duplicate session request",
        );
        assert(
          !requests.some(
            (p) =>
              p.endsWith("/photos") ||
              /^\/api\/v1\/setups\/[0-9a-f-]+$/.test(p),
          ),
          "per-card metadata/detail waterfall",
        );
        assert.deepEqual(errors, []);
        reports.push({
          page: scenario.name,
          width,
          mode,
          dataMs,
          coverMs,
          requestCount: requests.length,
        });
        assert(
          dataMs < 1500,
          `${scenario.name}: data took ${dataMs}ms (budget 1500ms)`,
        );
        assert(
          coverMs < 2000,
          `${scenario.name}: first cover took ${coverMs}ms (budget 2000ms)`,
        );
      }
      await context.close();
    }
  }
} finally {
  await mkdir("artifacts/performance", { recursive: true });
  await writeFile(
    "artifacts/performance/pages.json",
    JSON.stringify({ apiDelayMs: 120, mockedAPI: true, reports }, null, 2),
  );
  console.table(reports);
  await browser?.close();
  if (preview && preview.exitCode === null) {
    const exited = once(preview, "exit");
    preview.kill();
    await exited;
  }
}
