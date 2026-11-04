import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5191",
  api = "http://127.0.0.1:8091";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5191",
    "--strictPort",
  ],
  { env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" },
);
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const source = await readFile("scripts/fixtures/photo-shapes/portrait-3-4.jpg");
let browser;
try {
  for (let n = 0; n < 100; n++) {
    try {
      await fetch(origin);
      break;
    } catch {
      if (n === 99) throw Error("Profile QA Vite unavailable");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  await mkdir("artifacts/public-qa", { recursive: true });
  for (const [width, height] of [
    [320, 900],
    [390, 844],
    [1280, 900],
    [640, 360],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let member = true,
      uploads = 0,
      deletes = 0,
      patches = 0,
      revision = 0;
    const errors = [],
      unexpected = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let user = {
      id,
      nickname: "Track driver",
      email: "driver@example.test",
      avatar_url: "https://images.example.test/google.jpg",
      created_at: "2026-09-30T12:00:00Z",
      instagram_url: "https://instagram.com/track_driver",
      tiktok_url: "https://tiktok.com/@track_driver",
      youtube_url: "https://youtube.com/@track_driver",
      has_custom_avatar: false,
    };
    const publicProfile = (who) => ({
      id: who,
      nickname: who === id ? user.nickname : "Other driver",
      avatar_url: who === id ? user.avatar_url : null,
      instagram_url: user.instagram_url,
      tiktok_url: user.tiktok_url,
      youtube_url: user.youtube_url,
      member_since: user.created_at,
      public_setup_count: 2,
    });
    await page.route("https://images.example.test/google.jpg", (route) =>
      route.fulfill({ contentType: "image/jpeg", body: source }),
    );
    await page.route(`${api}/**`, async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname,
        method = request.method();
      const headers = {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
      };
      const respond = (json, status = 200) =>
        route.fulfill({ headers, json, status });
      if (method === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            ...headers,
            "access-control-allow-methods": "GET,PUT,DELETE,PATCH,POST,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
      if (path === "/api/v1/me" && method === "GET")
        return respond(
          member ? user : { error: "No session" },
          member ? 200 : 401,
        );
      if (path === "/api/v1/auth/logout") {
        member = false;
        return route.fulfill({ status: 204, headers });
      }
      if (path === "/api/v1/me" && method === "PATCH") {
        assert(member);
        patches++;
        user = { ...user, ...request.postDataJSON() };
        return respond(user);
      }
      if (path === "/api/v1/me/avatar" && method === "PUT") {
        assert(member);
        uploads++;
        assert.match(request.headers()["content-type"], /multipart\/form-data/);
        const bytes = request.postDataBuffer();
        assert(
          bytes.includes(Buffer.from([255, 216, 255])),
          "cropped payload is a JPEG",
        );
        revision++;
        user = {
          ...user,
          has_custom_avatar: true,
          avatar_url: `/api/v1/users/${id}/avatar/33333333-3333-4333-8333-${String(revision).padStart(12, "0")}`,
        };
        await new Promise((r) => setTimeout(r, 100));
        return respond(user);
      }
      if (path === "/api/v1/me/avatar" && method === "DELETE") {
        assert(member);
        deletes++;
        user = {
          ...user,
          has_custom_avatar: false,
          avatar_url: "https://images.example.test/google.jpg",
        };
        return respond(user);
      }
      if (path.includes("/avatar/")) {
        return route.fulfill({
          headers: { ...headers, "cache-control": "no-store, private" },
          contentType: "image/jpeg",
          status: path === user.avatar_url ? 200 : 404,
          body: path === user.avatar_url ? source : Buffer.from("missing"),
        });
      }
      if (path === `/api/v1/users/${id}` || path === `/api/v1/users/${other}`)
        return respond(publicProfile(path.split("/").at(-1)));
      if (path.endsWith("/public-setups"))
        return respond({
          items: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              title: "Approved public baseline",
              visibility: "public",
              schema_version: 1,
              chassis_model_id: null,
              chassis: null,
              cover_photo: null,
              owner: {
                id,
                nickname: user.nickname,
                avatar_url: user.avatar_url,
              },
              created_at: user.created_at,
              updated_at: user.created_at,
            },
          ],
          next_cursor: null,
        });
      if (path === "/api/v1/friendships")
        return respond({ incoming: [], outgoing: [], accepted: [] });
      if (path === "/api/v1/chassis/brands") return respond([]);
      if (path === "/api/v1/setups/search")
        return respond({ items: [], next_cursor: null });
      if (path === "/api/v1/me/setups") return respond([]);
      unexpected.push(method + " " + path);
      return respond({ error: "Unexpected" }, 500);
    });
    await page.goto(`${origin}/users/${id}`);
    await page
      .getByRole("heading", { name: "Track driver", exact: true })
      .waitFor();
    await page.getByText("Approved public baseline", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("2 public setups", { exact: true }).count(),
      1,
    );
    assert.equal(
      await page.getByText("September 2026", { exact: true }).count(),
      1,
    );
    assert.equal(await page.getByText(user.email, { exact: true }).count(), 0);
    assert.equal(
      await page
        .getByRole("navigation", { name: "Driver social profiles" })
        .getByRole("link")
        .count(),
      3,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `artifacts/public-qa/profile-own-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Change profile details", exact: true })
      .click();
    await page.getByLabel("Nickname", { exact: true }).fill("Local draft");
    await page.screenshot({
      path: `artifacts/public-qa/profile-edit-${width}.png`,
      fullPage: true,
    });
    const pick = page.getByLabel("Choose avatar file");
    await pick.setInputFiles({
      name: "driver.jpg",
      mimeType: "image/jpeg",
      buffer: source,
    });
    const dialog = page.getByRole("dialog", { name: "Adjust avatar" });
    await dialog.waitFor();
    const frame = dialog.getByRole("group", { name: "Square avatar preview" });
    await page.getByRole("button", { name: "Use this avatar" }).waitFor();
    await page.getByRole("button", { name: "Use this avatar" }).isEnabled();
    await page.getByRole("slider", { name: "Avatar zoom" }).fill("2");
    await frame.focus();
    await page.keyboard.press("ArrowDown");
    const box = await frame.boundingBox();
    assert(box && Math.abs(box.width - box.height) < 1, "square preview");
    await page.screenshot({
      path: `artifacts/public-qa/profile-crop-${width}.png`,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(uploads, 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Upload avatar", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await pick.setInputFiles({
      name: "driver.jpg",
      mimeType: "image/jpeg",
      buffer: source,
    });
    await dialog.waitFor();
    await page.getByRole("button", { name: "Use this avatar" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(uploads, 1);
    assert.equal(patches, 0);
    assert.equal(
      await page.getByLabel("Nickname", { exact: true }).inputValue(),
      "Local draft",
    );
    await pick.setInputFiles({
      name: "replacement.jpg",
      mimeType: "image/jpeg",
      buffer: source,
    });
    await dialog.waitFor();
    await page.getByRole("button", { name: "Use this avatar" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(uploads, 2);
    await page
      .getByRole("button", { name: "Remove avatar", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel removal" }).click();
    assert.equal(deletes, 0);
    await page
      .getByRole("button", { name: "Remove avatar", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/public-qa/profile-remove-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await page.getByText("Avatar removed.", { exact: true }).waitFor();
    assert.equal(deletes, 1);
    await page
      .getByLabel("Instagram URL", { exact: true })
      .fill("https://instagram.com/new_driver");
    await page.getByRole("button", { name: "Save profile details" }).click();
    await page.getByText("Profile details saved.", { exact: true }).waitFor();
    assert.equal(patches, 1);
    await page.getByRole("link", { name: "Back to profile" }).click();
    await page
      .getByRole("heading", { name: "Local draft", exact: true })
      .waitFor();
    await page.goto(`${origin}/users/${other}`);
    await page
      .getByRole("heading", { name: "Other driver", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Change profile details" }).count(),
      0,
    );
    if (width < 768) {
      await page
        .getByRole("banner")
        .getByRole("link", { name: "Your profile", exact: true })
        .click();
    } else {
      await page
        .getByRole("region", { name: "Your session" })
        .getByRole("link", { name: "Local draft", exact: true })
        .click();
    }
    await page
      .getByRole("heading", { name: "Local draft", exact: true })
      .waitFor();
    if (width < 768) {
      await page.getByRole("button", { name: "Open account menu" }).click();
      const menu = page.getByRole("dialog", { name: "Account and navigation" });
      await menu.getByRole("button", { name: "Help & Feedback" }).click();
      await page.getByRole("button", { name: "Close help" }).click();
      await menu.getByRole("link", { name: "Account", exact: true }).click();
      await menu.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Open account menu" }).click();
      await menu.getByRole("button", { name: "Sign out", exact: true }).click();
    } else {
      await page
        .getByRole("region", { name: "Your session" })
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Change profile details" }).count(),
      0,
    );
    assert.equal(await page.getByText(user.email, { exact: true }).count(), 0);
    await page.screenshot({
      path: `artifacts/public-qa/profile-guest-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    await context.close();
  }
  console.log(
    "Driver profile mobile/desktop navigation, edits, real canvas crop, immediate avatar lifecycle, guest transition and screenshots passed.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
