import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173"],
  {
    env: { ...process.env, VITE_API_URL: "http://127.0.0.1:8080" },
    stdio: "ignore",
  },
);
const placeholder = await readFile(
  "public/images/setup-photo-placeholder.webp",
);
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch("http://127.0.0.1:5173");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
      if (attempt === 99) throw Error("Vite unavailable");
    }
  }
  browser = await chromium.launch({ headless: true });
  for (const width of [375, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.addCookies([
      {
        name: "rc_session",
        value: "photo-smoke",
        url: "http://127.0.0.1:8080",
      },
    ]);
    const page = await context.newPage();
    const user = {
      id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
      nickname: "Driver",
      email: "driver@example.test",
      avatar_url: null,
      created_at: "2026-10-12T12:00:00Z",
    };
    const id = "c61393b6-daa0-4eb8-923c-57aedbb46a47";
    let setup = {
      id,
      owner_id: user.id,
      title: "Photo browser setup",
      visibility: "public",
      notes: null,
      schema_version: 1,
      chassis: null,
      chassis_model_id: null,
      cover_photo: null,
      data: {
        suspension: {
          front: { top_arm_spacing: { front_mm: 0, rear_mm: 5.2 } },
        },
      },
      created_at: user.created_at,
      updated_at: user.created_at,
    };
    let photos = [];
    let creates = 0;
    let uploadCalls = 0;
    let fail = true;
    const photo = (n) => ({
      id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
      setup_id: id,
      width: 600,
      height: 400,
      thumbnail_width: 600,
      thumbnail_height: 400,
      content_type: "image/jpeg",
      is_cover: n === 1,
      created_at: user.created_at,
      url: `/api/v1/setups/${id}/photos/${n}/image`,
      thumbnail_url: `/api/v1/setups/${id}/photos/${n}/thumbnail`,
    });
    await page.route("http://127.0.0.1:8080/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      const headers = {
        "access-control-allow-origin": "http://127.0.0.1:5173",
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type",
        "cache-control": "no-store, private",
      };
      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      assert(
        req.headers().cookie?.includes("rc_session=photo-smoke"),
        "cookie credentials omitted",
      );
      let body,
        status = 200;
      if (path === "/api/v1/me") body = user;
      else if (path === "/api/v1/chassis/brands") body = [];
      else if (path === "/api/v1/friendships")
        body = { incoming: [], outgoing: [], accepted: [] };
      else if (path === `/api/v1/users/${user.id}`)
        body = { id: user.id, nickname: user.nickname, avatar_url: null };
      else if (
        path === "/api/v1/me/setups" ||
        path === `/api/v1/users/${user.id}/setups`
      )
        body = [setup];
      else if (path === "/api/v1/setups/search")
        body = {
          items: [
            {
              ...setup,
              owner: { id: user.id, nickname: user.nickname, avatar_url: null },
            },
          ],
          next_cursor: null,
        };
      else if (path === "/api/v1/setups" && req.method() === "POST") {
        creates++;
        setup = { ...setup, ...req.postDataJSON() };
        body = setup;
        status = 201;
      } else if (path === `/api/v1/setups/${id}`) {
        if (req.method() === "PATCH")
          setup = { ...setup, ...req.postDataJSON() };
        body = setup;
      } else if (path === `/api/v1/setups/${id}/photos`) {
        if (req.method() === "POST") {
          uploadCalls++;
          if (fail && uploadCalls === 2) {
            await route.fulfill({
              status: 503,
              headers,
              contentType: "application/json",
              body: JSON.stringify({ error: "busy" }),
            });
            return;
          }
          photos.push(photo(photos.length + 1));
          setup = {
            ...setup,
            cover_photo: photos.find((p) => p.is_cover) ?? null,
          };
          body = photos.at(-1);
          status = 201;
        } else body = photos;
      } else if (path.endsWith("/cover")) {
        const target = path.split("/").at(-2);
        photos = photos.map((p) => ({ ...p, is_cover: p.id === target }));
        setup = {
          ...setup,
          cover_photo: photos.find((p) => p.is_cover) ?? null,
        };
        body = setup.cover_photo;
      } else if (req.method() === "DELETE" && path.includes("/photos/")) {
        const target = path.split("/").at(-1);
        photos = photos.filter((p) => p.id !== target);
        if (!photos.some((p) => p.is_cover))
          photos = photos.map((p, i) => ({ ...p, is_cover: i === 0 }));
        setup = {
          ...setup,
          cover_photo: photos.find((p) => p.is_cover) ?? null,
        };
        await route.fulfill({ status: 204, headers });
        return;
      } else if (path.endsWith("/thumbnail") || path.endsWith("/image")) {
        await route.fulfill({
          headers,
          contentType: "image/webp",
          body: placeholder,
        });
        return;
      } else throw Error(`Unhandled ${req.method()} ${path}`);
      await route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    const geometry = async () =>
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px horizontal overflow`,
      );
    await page.goto("http://127.0.0.1:5173/my/setups");
    await page.getByAltText("No setup photo — placeholder").waitFor();
    assert.equal(
      await page
        .getByAltText("No setup photo — placeholder")
        .evaluate((img) => img.naturalWidth),
      600,
    );
    await geometry();
    await page.goto("http://127.0.0.1:5173/my/setups/new");
    await page.getByLabel("Title", { exact: true }).fill("New with photos");
    await page.getByLabel("Choose photos").setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: placeholder },
      { name: "phone.heic", mimeType: "image/heic", buffer: placeholder },
    ]);
    await page
      .getByRole("button", { name: "Create setup", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retry phone.heic", exact: true })
      .waitFor();
    assert.equal(creates, 1);
    fail = false;
    await page
      .getByRole("button", { name: "Retry phone.heic", exact: true })
      .click();
    await page
      .getByText("Uploaded and saved", { exact: true })
      .nth(1)
      .waitFor();
    assert.equal(creates, 1);
    assert.equal(photos.length, 2);
    await geometry();
    await page.goto(`http://127.0.0.1:5173/setups/${id}`);
    await page
      .getByRole("button", { name: "Enlarge photo 1 (cover)", exact: true })
      .click();
    const viewer = page.getByRole("dialog", { name: "Enlarged setup photo" });
    await viewer.waitFor();
    assert(
      await viewer
        .getByRole("button", { name: "Close photo" })
        .evaluate((el) => document.activeElement === el),
    );
    await page.keyboard.press("Shift+Tab");
    assert(
      await viewer
        .getByRole("button", { name: "Next photo" })
        .evaluate((el) => document.activeElement === el),
    );
    await viewer.getByRole("button", { name: "Next photo" }).click();
    await viewer.getByText("Photo 2 of 2", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert(
      await page
        .getByRole("button", { name: "Enlarge photo 1 (cover)" })
        .evaluate((el) => document.activeElement === el),
    );
    await geometry();
    await page.getByRole("link", { name: "Edit setup", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Unsaved photo title");
    await page
      .getByRole("button", { name: "Make photo 2 cover", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Make photo 1 cover", exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      "Unsaved photo title",
    );
    await geometry();
    for (const destination of ["/", "/my/setups", `/users/${user.id}`]) {
      await page.goto("http://127.0.0.1:5173" + destination);
      await page.getByAltText(`Cover of ${setup.title}`).waitFor();
      await geometry();
    }
    await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
    await page
      .getByRole("button", { name: "Delete photo 2", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm delete photo 2", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete photo 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm delete photo 1", exact: true })
      .click();
    await page
      .getByText("0/10 photo slots used (saved and queued).", { exact: true })
      .waitFor();
    await page.goto("http://127.0.0.1:5173/my/setups");
    await page.getByAltText("No setup photo — placeholder").waitFor();
    await geometry();
    console.log(
      `PASS ${width}px placeholder decode/create once/partial retry/gallery keyboard/unsaved fields/all list covers/delete fallback/final/no overflow; mocked HTTP, file-picker automation`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
