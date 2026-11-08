import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5192",
  api = "http://127.0.0.1:8092";
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5192",
    "--strictPort",
  ],
  { env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" },
);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "Track driver",
  email: "driver@example.test",
  avatar_url: null,
  created_at: "2026-09-30T12:00:00Z",
  has_custom_avatar: false,
};
const setup = {
  id: "22222222-2222-4222-8222-222222222222",
  owner_id: user.id,
  title: "Yokomo RD2.0 — polished asphalt",
  visibility: "public",
  moderation_status: "approved",
  chassis_model_id: null,
  chassis: null,
  data: { suspension: { front: { camber_deg: -4.5, toe_deg: 0 } } },
  notes: "Balanced baseline for the local drift track.",
  schema_version: 1,
  created_at: user.created_at,
  updated_at: user.created_at,
  cover_photo: null,
};
const image = await readFile("scripts/fixtures/photo-shapes/portrait-3-4.jpg");
const photo = {
  id: "33333333-3333-4333-8333-333333333333",
  setup_id: setup.id,
  width: 300,
  height: 400,
  thumbnail_width: 300,
  thumbnail_height: 400,
  content_type: "image/jpeg",
  is_cover: true,
  crop: null,
  thumbnail_revision: 0,
  created_at: setup.created_at,
  url: `/api/v1/setups/${setup.id}/photos/photo/image`,
  thumbnail_url: `/api/v1/setups/${setup.id}/photos/photo/thumbnail`,
};
let browser;
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Vite startup */
    }
    if (n === 99) throw Error("Moderation QA Vite unavailable");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  await mkdir("artifacts/public-qa", { recursive: true });
  for (const width of [320, 390, 1280]) {
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
        hasTouch: width < 768,
      });
      const page = await context.newPage();
      const errors = [],
        unexpected = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let state = "pending",
        member = true,
        owner = true;
      await page.route(`${api}/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
        };
        const json = (value, status = 200) =>
          route.fulfill({ headers, json: value, status });
        if (route.request().method() === "OPTIONS")
          return route.fulfill({
            headers: {
              ...headers,
              "access-control-allow-methods": "GET,POST,OPTIONS",
              "access-control-allow-headers": "content-type",
            },
            status: 204,
          });
        if (path === "/api/v1/me")
          return json(member ? user : { error: "Guest" }, member ? 200 : 401);
        if (path === "/api/v1/auth/logout") {
          member = false;
          return route.fulfill({ headers, status: 204 });
        }
        if (path === `/api/v1/setups/${setup.id}`)
          return json({
            ...setup,
            moderation_status: state,
            owner_id: owner ? user.id : photo.id,
          });
        if (path === `/api/v1/setups/${setup.id}/photos`) return json([photo]);
        if (path.endsWith("/image") || path.endsWith("/thumbnail"))
          return route.fulfill({
            headers: { ...headers, "cache-control": "no-store" },
            contentType: "image/jpeg",
            body: image,
          });
        if (path.startsWith("/api/v1/users/"))
          return json({
            ...user,
            id: owner ? user.id : photo.id,
            member_since: user.created_at,
            public_setup_count: state === "approved" ? 1 : 0,
          });
        unexpected.push(path);
        return json({ error: "Unhandled fixture" }, 500);
      });
      for (const [status, label] of [
        ["pending", "Pending review"],
        ["approved", "Approved"],
        ["rejected", "Rejected"],
      ]) {
        state = status;
        await page.goto(`${origin}/setups/${setup.id}`);
        await page
          .getByRole("status", { name: "Moderation status" })
          .filter({ hasText: label })
          .waitFor();
        await page.getByRole("img", { name: "Setup photo 1" }).waitFor();
        assert.equal(
          await page.getByText("Public", { exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByRole("link", { name: "Edit setup" }).count(),
          1,
        );
        if (status !== "approved")
          assert.equal(await page.getByText(/Your setup/).count(), 1);
        const layout = await page.evaluate(() => {
          const badge = document.querySelector(
            '[aria-label="Moderation status"]',
          );
          const title = document.querySelector(".setup-detail .page-title");
          const actions = document.querySelector(".setup-detail-actions");
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            badge: badge.getBoundingClientRect().toJSON(),
            title: title.getBoundingClientRect().toJSON(),
            actions: actions.getBoundingClientRect().toJSON(),
            hiddenIcons: [...badge.querySelectorAll("svg")].every(
              (icon) => icon.getAttribute("aria-hidden") === "true",
            ),
          };
        });
        assert(
          !layout.overflow,
          `${width}/${colorScheme}/${status}: horizontal overflow`,
        );
        assert(
          layout.badge.top >= layout.title.bottom &&
            layout.actions.top >= layout.badge.bottom,
        );
        assert(layout.badge.height >= 24 && layout.badge.height <= 28);
        assert(layout.hiddenIcons);
        await page.screenshot({
          path: `artifacts/public-qa/moderation-${status}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
      owner = false;
      state = "pending";
      await page.reload();
      await page.getByRole("heading", { name: setup.title }).waitFor();
      assert.equal(
        await page.getByRole("status", { name: "Moderation status" }).count(),
        0,
      );
      assert.equal(await page.getByText(/Your setup/).count(), 0);
      assert.equal(
        await page.getByRole("link", { name: "Edit setup" }).count(),
        0,
      );
      member = false;
      await page.reload();
      await page.getByText("Setup not found or unavailable.").waitFor();
      assert.equal(
        await page.getByRole("heading", { name: setup.title }).count(),
        0,
      );
      assert.equal(await page.locator(".setup-detail img").count(), 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      await context.close();
      console.log(
        `Moderation ${width}px ${colorScheme}: states, owner/friend/guest privacy and layout passed`,
      );
    }
  }
} finally {
  await browser?.close();
  vite.kill();
}
