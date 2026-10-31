import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5188",
  api = "http://127.0.0.1:8088";
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5188"],
  { env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" },
);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "Track pilot",
  email: "pilot@example.test",
  avatar_url: null,
  created_at: "2026-10-31T10:00:00Z",
};
const source = {
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
  running_gear_manufacturers: null,
  rear_differential_manufacturer: null,
  lower_arm_mount_manufacturers: null,
  front_steering_knuckle_manufacturer: null,
};
const copy = {
  ...source,
  id: "33333333-3333-4333-8333-333333333333",
  title: source.title + " (Copy)",
  visibility: "private",
  moderation_status: "pending",
  source_setup_id: source.id,
};
const image = await readFile("scripts/fixtures/photo-shapes/portrait-3-4.jpg");
const photo = {
  id: "44444444-4444-4444-8444-444444444444",
  setup_id: source.id,
  width: 300,
  height: 400,
  thumbnail_width: 300,
  thumbnail_height: 300,
  content_type: "image/jpeg",
  is_cover: true,
  crop: null,
  thumbnail_revision: 0,
  created_at: source.created_at,
  url: "/image",
  thumbnail_url: "/thumbnail",
};
let browser;
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Vite startup */
    }
    if (n === 99) throw Error("Vite unavailable");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await mkdir("artifacts/public-qa", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  for (const [width, height] of [
    [320, 900],
    [390, 844],
    [1280, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let member = true,
      writes = 0,
      unavailable = false;
    const requestIds = [];
    await page.route(`${api}/**`, async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      const headers = {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      };
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (path === "/api/v1/me")
        return member ? json(user) : json({ error: "No session" }, 401);
      if (path.endsWith("/clone")) {
        writes++;
        requestIds.push(request.postDataJSON().request_id);
        assert.equal(request.method(), "POST");
        await new Promise((resolve) => setTimeout(resolve, 200));
        return unavailable
          ? json({ error: "Unavailable" }, 404)
          : json(copy, 201);
      }
      if (path === `/api/v1/setups/${source.id}`) return json(source);
      if (path === `/api/v1/setups/${copy.id}`) return json(copy);
      if (path === `/api/v1/setups/${source.id}/photos`) return json([photo]);
      if (path.endsWith("/photos")) return json([]);
      if (path.endsWith("/image") || path.endsWith("/thumbnail"))
        return route.fulfill({
          headers,
          contentType: "image/jpeg",
          body: image,
        });
      if (path.startsWith("/api/v1/users/")) return json(user);
      if (path === "/api/v1/chassis/brands") return json([]);
      if (path === "/api/v1/setups/search")
        return json({ items: [], next_cursor: null });
      throw Error("Unhandled clone browser request " + path);
    });
    await page.goto(`${origin}/setups/${source.id}`);
    await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .waitFor();
    const adjacent = await page
      .getByRole("button", { name: "Copy link", exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          border: s.borderRadius,
          font: s.fontFamily,
          minHeight: s.minHeight,
        };
      });
    const cloneStyle = await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          border: s.borderRadius,
          font: s.fontFamily,
          minHeight: s.minHeight,
        };
      });
    assert.deepEqual(
      cloneStyle,
      adjacent,
      "Clone must use the adjacent shared action style",
    );
    await page.screenshot({
      path: `artifacts/public-qa/clone-${width}-rest.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Clone setup?" });
    await dialog.waitFor();
    assert.equal(writes, 0);
    await page.screenshot({
      path: `artifacts/public-qa/clone-${width}-confirmation.png`,
      fullPage: true,
    });
    assert.equal(
      await dialog
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Create private copy", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Cancel", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: "Clone setup", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Create private copy", exact: true })
      .dblclick();
    await page.waitForURL(`**/setups/${copy.id}`);
    await page
      .getByText("Private copy created. Photos were not copied.")
      .waitFor();
    await page.getByText("No photos yet.").waitFor();
    assert.equal(writes, 1);
    assert.equal(requestIds.length, 1);
    assert.equal(
      await page
        .getByRole("button", { name: "Clone setup", exact: true })
        .count(),
      0,
    );
    await page.goto(`${origin}/setups/${source.id}`);
    unavailable = true;
    await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Create private copy", exact: true })
      .click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(writes, 2);
    assert.equal(new URL(page.url()).pathname, `/setups/${source.id}`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    member = false;
    let oauth = 0;
    await page.route("**/auth/google", (route) => {
      oauth++;
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Sign in provider",
      });
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Clone setup", exact: true })
      .click();
    await page.waitForURL("**/auth/google");
    assert.equal(oauth, 1);
    assert.equal(writes, 2);
    member = true;
    unavailable = false;
    await page.goto(origin);
    await dialog.waitFor();
    assert.equal(writes, 2, "OAuth continuation must not write");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No horizontal overflow",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Clone mobile/desktop browser interactions and screenshots passed.",
  );
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
}
