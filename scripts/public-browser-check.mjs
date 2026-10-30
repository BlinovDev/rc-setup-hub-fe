import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:5175";
const api = "http://127.0.0.1:8081";
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5175"],
  {
    env: { ...process.env, VITE_API_URL: api },
    stdio: "ignore",
  },
);
const image = await readFile("scripts/fixtures/photo-shapes/portrait-3-4.jpg");
const id = "c61393b6-daa0-4eb8-923c-57aedbb46a47";
const privateId = "c61393b6-daa0-4eb8-923c-57aedbb46a48";
const ownerId = "c61393b6-daa0-4eb8-923c-57aedbb46a46";
const photoId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const owner = {
  id: ownerId,
  nickname: "Public pilot",
  avatar_url: `${api}/api/v1/setups/${id}/image`,
};
const user = {
  ...owner,
  email: "private-account@example.test",
  created_at: "2026-10-01T12:00:00Z",
};
const publicSetup = {
  id,
  owner_id: ownerId,
  title: "Public drift setup with a long title for narrow screens",
  visibility: "public",
  chassis_model_id: null,
  chassis: null,
  data: { suspension: { front: { camber_deg: 0, toe_deg: -1.25 } } },
  notes: "Public track notes",
  schema_version: 1,
  moderation_status: "approved",
  created_at: user.created_at,
  updated_at: user.created_at,
  cover_photo: null,
  front_steering_knuckle_manufacturer: null,
  rear_differential_manufacturer: null,
  lower_arm_mount_manufacturers: null,
  running_gear_manufacturers: null,
};
const summary = { ...publicSetup, owner };
const photo = (setupId) => ({
  id: photoId,
  setup_id: setupId,
  width: 300,
  height: 400,
  thumbnail_width: 300,
  thumbnail_height: 300,
  content_type: "image/jpeg",
  is_cover: true,
  crop: null,
  thumbnail_revision: 0,
  created_at: user.created_at,
  url: "/image",
  thumbnail_url: "/thumbnail",
});
let browser;
const failures = [];
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(origin);
      break;
    } catch {
      if (attempt === 99) throw Error("Vite unavailable");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await mkdir("artifacts/public-qa", { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const [width, height] of [
    [320, 900],
    [375, 900],
    [390, 900],
    [768, 900],
    [1280, 900],
    [640, 360],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    let authenticated = false,
      revoked = false,
      empty = false,
      failSearch = false,
      writes = 0,
      oauth = 0,
      protectedLists = 0;
    const errors = [],
      pending = new Set();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      window.__revokedURLs = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => {
        window.__revokedURLs.push(url);
        revoke(url);
      };
    });
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store, private",
    };
    const handler = async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (path === "/auth/google") {
        oauth++;
        authenticated = true;
        await context.addCookies([
          {
            name: "rc_session",
            value: "public-browser",
            url: api,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        return route.fulfill({
          status: 302,
          headers: { ...headers, location: origin },
        });
      }
      if (authenticated)
        assert(
          request.headers().cookie?.includes("rc_session=public-browser"),
          "authenticated credentials missing",
        );
      let status = 200,
        body;
      if (path === "/api/v1/me") {
        status = authenticated ? 200 : 401;
        body = authenticated ? user : { error: "No session" };
      } else if (
        path === "/api/v1/auth/logout" &&
        request.method() === "POST"
      ) {
        authenticated = false;
        return route.fulfill({ status: 204, headers });
      } else if (request.method() !== "GET") {
        writes++;
        status = 401;
        body = { error: "No session" };
      } else if (path === "/api/v1/chassis/brands") body = [];
      else if (path === "/api/v1/setups/search") {
        if (failSearch) {
          status = 429;
          body = { error: "not for display" };
        } else
          body = {
            items: empty
              ? []
              : [
                  url.searchParams.has("cursor")
                    ? { ...summary, id: otherId, title: "Second public setup" }
                    : summary,
                ],
            next_cursor:
              empty || url.searchParams.has("cursor") ? null : "opaque",
          };
      } else if (path === `/api/v1/users/${ownerId}`) body = owner;
      else if (path === `/api/v1/users/${ownerId}/public-setups`)
        body = { items: empty ? [] : [summary], next_cursor: null };
      else if (path === `/api/v1/users/${ownerId}/setups`) {
        protectedLists++;
        assert(authenticated);
        body = [
          {
            ...publicSetup,
            id: privateId,
            title: "Private driver data",
            visibility: "private",
          },
        ];
      } else if (path === "/api/v1/friendships") {
        assert(authenticated);
        body = { incoming: [], outgoing: [], accepted: [] };
      } else if (
        path.startsWith(`/api/v1/setups/${id}`) ||
        path.startsWith(`/api/v1/setups/${privateId}`)
      ) {
        const setupId = path.split("/")[4],
          isPrivate = setupId === privateId;
        if (isPrivate ? !authenticated : revoked) {
          status = 404;
          body = { error: "Not found" };
        } else if (path.endsWith("/image") || path.endsWith("/thumbnail"))
          return route.fulfill({
            status: 200,
            headers: { ...headers, "content-type": "image/jpeg" },
            body: image,
          });
        else if (path.endsWith("/photos")) body = [photo(setupId)];
        else
          body = {
            ...publicSetup,
            id: setupId,
            ...(isPrivate
              ? {
                  title: "Private driver data",
                  visibility: "private",
                  notes: "Private technical notes",
                }
              : {}),
          };
      } else throw Error(`Unexpected request: ${request.method()} ${path}`);
      return route.fulfill({
        status,
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    };
    await page.route(`${api}/**`, (route) => {
      const task = handler(route);
      pending.add(task);
      task.finally(() => pending.delete(task)).catch(() => {});
      return task;
    });
    const text = async () => page.locator("body").innerText();
    const robots = () =>
      page.locator('meta[name="robots"]').getAttribute("content");
    const noOverflow = async () =>
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "horizontal overflow",
      );
    try {
      console.log(`RUN public ${width}x${height}`);
      await page.goto(`${origin}/?q=drift`);
      await page
        .getByRole("link", { name: publicSetup.title, exact: true })
        .waitFor();
      assert.equal(oauth, 0);
      assert.equal(writes, 0);
      await page
        .getByRole("button", { name: "Load more", exact: true })
        .click();
      await page.getByText("Second public setup", { exact: true }).waitFor();
      await page
        .getByRole("textbox", { name: "Title or owner nickname" })
        .fill("new query");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL("**/?q=new+query");
      await page
        .getByRole("link", { name: publicSetup.title, exact: true })
        .waitFor();
      await noOverflow();
      failSearch = true;
      await page.reload();
      await page.getByRole("button", { name: "Retry search" }).waitFor();
      assert(!(await text()).includes("not for display"));
      failSearch = false;
      empty = true;
      await page.getByRole("button", { name: "Retry search" }).click();
      await page.getByText("No public setups match these filters.").waitFor();
      empty = false;
      await page.goto(`${origin}/users/${ownerId}`);
      await page.getByRole("heading", { name: owner.nickname }).waitFor();
      await page
        .getByRole("link", { name: publicSetup.title, exact: true })
        .waitFor();
      assert.equal(protectedLists, 0);
      assert(!(await text()).includes(user.email));
      assert.equal(await robots(), "noindex, nofollow");
      empty = true;
      await page.reload();
      await page.getByText("No public setups yet.").waitFor();
      empty = false;
      await page.goto(`${origin}/setups/${id}?tracking=ignored`);
      await page.getByRole("heading", { name: publicSetup.title }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector('meta[name="robots"]')?.content ===
          "index, follow",
      );
      const ownerLink = page.locator(`article a[href="/users/${ownerId}"]`);
      await ownerLink.waitFor();
      const ownerAlignment = await ownerLink.evaluate((link) => {
        const row = link.parentElement;
        const label = document.createRange();
        label.selectNodeContents(row.firstChild);
        const labelRect = label.getBoundingClientRect();
        const nameRect = link.querySelector("span").getBoundingClientRect();
        return Math.abs(
          labelRect.y + labelRect.height / 2 - nameRect.y - nameRect.height / 2,
        );
      });
      assert(
        ownerAlignment <= 2,
        `Owner label/name misaligned by ${ownerAlignment}px`,
      );
      assert.equal(await page.title(), `${publicSetup.title} | RC Setup Hub`);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        `${origin}/setups/${id}`,
      );
      assert.equal(
        await page.locator('meta[property="og:title"]').getAttribute("content"),
        await page.title(),
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Enlarge photo 1 (cover)" })
        .scrollIntoViewIfNeeded();
      await page.locator('img[alt="Setup photo 1"][src^="blob:"]').waitFor();
      const enlarge = page.getByRole("button", {
        name: "Enlarge photo 1 (cover)",
      });
      await enlarge.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("dialog", { name: "Enlarged setup photo" })
        .waitFor();
      await page
        .locator('img[alt="Enlarged setup photo 1"][src^="blob:"]')
        .waitFor();
      await page.keyboard.press("Escape");
      await enlarge.waitFor();
      assert(await enlarge.evaluate((el) => el === document.activeElement));
      await noOverflow();
      await page.screenshot({
        path: `artifacts/public-qa/public-${width}x${height}.png`,
        fullPage: true,
      });
      const raw = await (
        await page.request.get(`${origin}/setups/${id}`)
      ).text();
      assert(raw.includes('name="robots" content="noindex, nofollow"'));
      assert(
        !raw.includes(publicSetup.title),
        "static HTML must not be misreported as prerendered",
      );
      revoked = true;
      await page.reload();
      await page.getByText("Setup not found or unavailable.").waitFor();
      assert.equal(await robots(), "noindex, nofollow");
      assert(!(await text()).includes(publicSetup.title));
      revoked = false;
      for (const path of [
        "/my/setups/new",
        `/my/setups/${id}/edit`,
        "/settings",
        "/friends",
      ]) {
        await page.goto(origin + path);
        await page
          .getByRole("button", { name: "Sign in with Google" })
          .waitFor();
        assert.equal(await robots(), "noindex, nofollow");
        assert.equal(oauth, 0);
        assert.equal(writes, 0);
      }
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(origin + "/");
      await page
        .getByRole("navigation", {
          name: width < 768 ? "Mobile navigation" : "Main",
          exact: true,
        })
        .waitFor();
      assert.equal(oauth, 1);
      await page.goto(`${origin}/users/${ownerId}`);
      await page
        .getByRole("button", { name: "Setups visible to you", exact: true })
        .click();
      await page.getByText("Private driver data", { exact: true }).waitFor();
      assert.equal(protectedLists, 1);
      await page.goto(`${origin}/setups/${privateId}`);
      await page
        .getByRole("heading", { name: "Private driver data" })
        .waitFor();
      await page
        .getByRole("button", { name: "Enlarge photo 1 (cover)" })
        .scrollIntoViewIfNeeded();
      await page.locator('img[alt="Setup photo 1"][src^="blob:"]').waitFor();
      assert(
        await page.evaluate(() => {
          window.dispatchEvent(
            new PageTransitionEvent("pagehide", { persisted: true }),
          );
          return !document.body.textContent.includes("Private driver data");
        }),
        "persisted snapshot still contains private data",
      );
      await page.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true }),
        ),
      );
      await page
        .getByRole("heading", { name: "Private driver data" })
        .waitFor();
      await page
        .getByRole("button", { name: "Enlarge photo 1 (cover)" })
        .scrollIntoViewIfNeeded();
      await page.locator('img[alt="Setup photo 1"][src^="blob:"]').waitFor();
      const privateBlob = await page
        .getByAltText("Setup photo 1", { exact: true })
        .getAttribute("src");
      assert.equal(await robots(), "noindex, nofollow");
      if (width < 768)
        await page.getByRole("button", { name: "Open account menu" }).click();
      await page
        .getByRole("button", { name: "Sign out", exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .waitFor();
      await page.getByText("Setup not found or unavailable.").waitFor();
      assert(!(await text()).includes("Private driver data"));
      assert(!(await text()).includes("Private technical notes"));
      assert(
        await page.evaluate(
          (url) => window.__revokedURLs.includes(url),
          privateBlob,
        ),
        "private blob URL not revoked",
      );
      assert.equal(await page.locator(`img[src="${privateBlob}"]`).count(), 0);
      await page.goBack();
      await page.getByRole("heading", { name: owner.nickname }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Setups visible to you", exact: true })
          .count(),
        0,
      );
      assert(!(await text()).includes("Private driver data"));
      await page.goForward();
      await page.getByText("Setup not found or unavailable.").waitFor();
      assert.equal(await robots(), "noindex, nofollow");
      await noOverflow();
      assert.deepEqual(errors, []);
      assert.equal(writes, 0);
      console.log(
        `PASS public ${width}x${height}: guest Explore/search/pagination/error/empty, safe profiles, deep links/gallery/keyboard, rendered vs raw SEO, protected CTA, login/logout/private blob cleanup and history`,
      );
    } catch (error) {
      failures.push(`${width}x${height}: ${error}`);
      console.error(`FAIL public ${width}x${height}`, error);
      await page
        .screenshot({
          path: `artifacts/public-qa/failure-${width}x${height}.png`,
          fullPage: true,
        })
        .catch(() => {});
    } finally {
      await context.unrouteAll({ behavior: "wait" });
      await Promise.allSettled([...pending]);
      await context.close();
    }
  }
  assert.deepEqual(failures, [], "Public browser regressions");
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
}
