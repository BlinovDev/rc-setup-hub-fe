import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5176",
  api = "http://127.0.0.1:8083";
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5176",
    "--strictPort",
  ],
  { env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" },
);
const id = (n) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const owner = id(9),
  user = {
    id: owner,
    nickname: "Member pilot",
    email: "never-render@example.test",
    avatar_url: null,
    created_at: "2026-10-01T12:00:00Z",
  };
const make = (n, title, visibility, data) => ({
  id: id(n),
  owner_id: owner,
  title,
  visibility,
  data,
  notes: null,
  schema_version: 1,
  chassis_model_id: id(5),
  chassis: {
    brand_id: id(6),
    brand_name: "Yokomo",
    model_id: id(5),
    model_name: "RD2.0",
  },
  cover_photo: null,
  running_gear_manufacturers: null,
  rear_differential_manufacturer: null,
  lower_arm_mount_manufacturers: null,
  front_steering_knuckle_manufacturer: null,
  created_at: user.created_at,
  updated_at: user.created_at,
});
const a = make(1, "Alpha public", "public", {
  suspension: {
    front: {
      camber_deg: 0,
      upper_arm_length_mm: 42.5,
      toe_deg: 1,
      link_lengths: [
        { name: "Upper", length_mm: 25 },
        { name: "Tie rod", length_mm: 16.23456789 },
      ],
      lower_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
    },
  },
  shocks: {
    front: {
      piston: { holes: 3, hole_diameter_mm: 1.23456789 },
      seal: { type: "x-ring" },
    },
  },
  electronics: { motor: "10.5T" },
});
const b = {
  ...make(2, "Beta public", "public", {
    suspension: {
      front: {
        upper_arm_length_mm: 42.5,
        toe_deg: 2,
        link_lengths: [
          { name: "tie rod", length_mm: 16.23456789 },
          { name: "Upper", length_mm: 25 },
        ],
        lower_arm_spacing: { rear_mm: 5.2 },
      },
    },
    shocks: { front: { piston: { holes: 4 }, seal: { type: "x-ring" } } },
    electronics: { motor: "10.5T" },
  }),
  chassis: null,
  chassis_model_id: null,
};
const c = make(3, "Private owner setup", "private", {
  suspension: { front: { camber_deg: 0, toe_deg: 3 } },
});
const d = {
  ...make(4, "Accepted friend setup", "friends", {
    suspension: { front: { camber_deg: -1, toe_deg: 4 } },
  }),
  owner_id: id(8),
};
const summary = (s) => ({
  id: s.id,
  title: s.title,
  chassis: s.chassis,
  owner: { id: s.owner_id, nickname: "Safe pilot", avatar_url: null },
  cover_photo: null,
  created_at: s.created_at,
  updated_at: s.updated_at,
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin);
      break;
    } catch {
      if (i === 99) throw Error("Compare Vite unavailable");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await mkdir("artifacts/compare-qa", { recursive: true });
  for (const engine of ["chromium", "webkit"]) {
    browser = await { chromium, webkit }[engine].launch({ headless: true });
    for (const [width, height] of [
      [320, 900],
      [375, 900],
      [390, 900],
      [430, 932],
      [768, 900],
      [1280, 900],
      [640, 360],
    ]) {
      const context = await browser.newContext({
        ...(engine === "webkit" && width < 768 ? devices["iPhone 13"] : {}),
        viewport: { width, height },
        hasTouch: width < 768,
      });
      const inFlight = new Set();
      const releases = [];
      const release = () => releases.splice(0).forEach((resolve) => resolve());
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [],
          unexpected = [],
          visibleCalls = [],
          pairCalls = [];
        page.on("pageerror", (e) => errors.push(e.message));
        let member = false,
          accepted = true,
          identical = false,
          pairStatus = 200,
          holdNext = false,
          oauth = 0;
        const allowed = (s) =>
          s.visibility === "public" ||
          (member &&
            (s.owner_id === owner || (s.visibility === "friends" && accepted)));
        const headers = {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
        };
        const handle = async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            p = url.pathname;
          if (request.method() === "OPTIONS")
            return route.fulfill({
              status: 204,
              headers: {
                ...headers,
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-headers": "content-type",
              },
            });
          if (p === "/auth/google") {
            member = true;
            oauth++;
            return route.fulfill({
              headers,
              contentType: "text/html",
              body: `<meta http-equiv="refresh" content="0;url=${origin}/">`,
            });
          }
          if (p === "/api/v1/me")
            return route.fulfill({
              status: member ? 200 : 401,
              headers,
              json: member ? user : {},
            });
          if (p === "/api/v1/auth/logout" && request.method() === "POST") {
            member = false;
            return route.fulfill({ status: 204, headers });
          }
          assert.equal(
            request.method(),
            "GET",
            "comparison must never write setup data",
          );
          if (p === "/api/v1/chassis/brands")
            return route.fulfill({ headers, json: [] });
          if (p === "/api/v1/setups/search")
            return route.fulfill({
              headers,
              json: { items: [], next_cursor: null },
            });
          if (p === `/api/v1/users/${owner}`)
            return route.fulfill({
              headers,
              json: { id: owner, nickname: "Safe pilot", avatar_url: null },
            });
          if (p === `/api/v1/setups/${a.id}`)
            return route.fulfill({ headers, json: a });
          if (p === `/api/v1/setups/${a.id}/photos`)
            return route.fulfill({ headers, json: [] });
          if (p === "/api/v1/setups/visible") {
            visibleCalls.push({
              member,
              q: url.searchParams.get("q"),
              cursor: url.searchParams.get("cursor"),
            });
            assert.equal(url.searchParams.get("limit"), "20");
            const q = (url.searchParams.get("q") ?? "").toLowerCase();
            const all = [a, b, c, d]
              .filter(allowed)
              .filter((s) => s.title.toLowerCase().includes(q));
            const pageItems =
              q || url.searchParams.has("cursor")
                ? all.filter((s) => q || s.id !== a.id)
                : all.slice(0, 1);
            return route.fulfill({
              headers,
              json: {
                items: pageItems.map(summary),
                next_cursor:
                  !q && !url.searchParams.has("cursor") ? "page-two" : null,
              },
            });
          }
          if (p === "/api/v1/setups/compare") {
            pairCalls.push({
              member,
              left: url.searchParams.get("left_id"),
              right: url.searchParams.get("right_id"),
            });
            assert.deepEqual([...url.searchParams.keys()].sort(), [
              "left_id",
              "right_id",
            ]);
            const left = [a, b, c, d].find(
                (s) => s.id === url.searchParams.get("left_id"),
              ),
              right = [a, b, c, d].find(
                (s) => s.id === url.searchParams.get("right_id"),
              );
            const permitted =
              left &&
              right &&
              left.id !== right.id &&
              allowed(left) &&
              allowed(right);
            const status = permitted ? pairStatus : 404;
            const payload = permitted
              ? {
                  left,
                  right: identical
                    ? { ...left, id: right.id, title: right.title }
                    : right,
                }
              : {};
            if (holdNext && member) {
              await new Promise((resolve) => releases.push(resolve));
            }
            return route.fulfill({
              status,
              headers,
              json:
                status === 200
                  ? payload
                  : { error: "never show raw database information" },
            });
          }
          unexpected.push(p);
          return route.abort();
        };
        await page.route(api + "/**", (route) => {
          const work = handle(route);
          inFlight.add(work);
          return work.finally(() => inFlight.delete(work));
        });
        const mobile = width < 768;
        const nav = () =>
          page.getByRole("navigation", {
            name: "Mobile navigation",
            exact: true,
          });
        const goCompare = async () => {
          if (mobile) {
            await page
              .getByRole("button", {
                name: member ? "Open account menu" : "Open navigation menu",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", { name: "Account and navigation" })
              .getByRole("link", { name: "Compare", exact: true })
              .click();
          } else
            await page
              .getByRole("navigation", {
                name: member ? "Main" : "Public navigation",
                exact: true,
              })
              .getByRole("link", { name: "Compare", exact: true })
              .click();
          await page
            .getByRole("heading", { name: "Compare setups", exact: true })
            .waitFor();
        };
        const result = () =>
          page.getByRole("heading", { name: "Setup comparison", exact: true });
        const front = () =>
          page.getByRole("region", { name: "Front suspension", exact: true });
        const row = (name) =>
          front()
            .getByRole("rowheader", { name: new RegExp(name, "i") })
            .locator("..");
        const search = async (q) => {
          await page
            .getByRole("textbox", { name: "Title or owner nickname" })
            .fill(q);
          await page
            .getByRole("button", { name: "Search setups", exact: true })
            .click();
        };
        await page.goto(origin + "/");
        await page
          .getByRole("heading", { name: "Explore", exact: true })
          .waitFor();
        await goCompare();
        if (mobile) {
          assert.deepEqual(
            await nav()
              .locator(":scope > a, :scope > button")
              .allTextContents(),
            ["Explore", "My setups", "Help & Feedback"],
          );
          const h = page.getByRole("banner");
          assert.equal(await h.getByRole("navigation").count(), 0);
          const title = await h.getByRole("heading").boundingBox(),
            signIn = await h
              .getByRole("button", { name: "Sign in", exact: true })
              .boundingBox();
          assert(
            Math.abs(
              title.y + title.height / 2 - signIn.y - signIn.height / 2,
            ) < 2,
            "guest header remains one row with the new menu",
          );
        }
        await page
          .getByRole("button", {
            name: "Select Alpha public as first setup",
            exact: true,
          })
          .waitFor();
        await page
          .getByRole("button", { name: "Load more setups", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Select Beta public as first setup",
            exact: true,
          })
          .waitFor();
        assert.equal(
          await page.getByRole("button", { name: /Select Private/ }).count(),
          0,
        );
        assert.equal(
          await page.getByRole("button", { name: /Select Accepted/ }).count(),
          0,
        );
        await page
          .getByRole("button", {
            name: "Select Alpha public as first setup",
            exact: true,
          })
          .click();
        assert(
          await page
            .getByRole("button", {
              name: "Select Alpha public as second setup",
              exact: true,
            })
            .isDisabled(),
        );
        await search("Beta");
        await page
          .getByRole("button", {
            name: "Select Beta public as second setup",
            exact: true,
          })
          .click();
        await result().waitFor();
        assert.deepEqual(
          await row("Camber").getByRole("cell").allTextContents(),
          ["0", "Not specified"],
        );
        assert.deepEqual(
          await row("^Tie rod").getByRole("cell").allTextContents(),
          ["16.23456789", "16.23456789"],
        );
        assert.deepEqual(
          await row("^Steering tie rod").getByRole("cell").allTextContents(),
          ["Not specified", "Not specified"],
        );
        assert.deepEqual(
          await row("^Upper arm").getByRole("cell").allTextContents(),
          ["42.5", "42.5"],
        );
        assert(await page.getByText(/Different or custom chassis/).isVisible());
        assert.equal(
          await page.locator('meta[name="robots"]').getAttribute("content"),
          "noindex, nofollow",
        );
        const table = page.getByRole("table").first();
        assert.equal(await table.locator('thead th[scope="col"]').count(), 3);
        assert((await table.locator('tbody th[scope="row"]').count()) > 0);
        const scroll = page.getByRole("region", {
          name: "Front suspension comparison table",
          exact: true,
        });
        if (
          mobile &&
          (await scroll.evaluate((el) => el.scrollWidth > el.clientWidth))
        ) {
          await scroll.focus();
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction(
            () =>
              document.querySelector(
                '[aria-label="Front suspension comparison table"]',
              ).scrollLeft > 0,
          );
          await scroll.evaluate((el) => (el.scrollLeft = el.scrollWidth));
          assert(
            await scroll.evaluate((el) => {
              const param = el
                .querySelector('th[scope="row"]')
                .getBoundingClientRect();
              const last = el
                .querySelector("tbody td:last-child")
                .getBoundingClientRect();
              return (
                last.left >= param.right - 1 &&
                last.right <= el.getBoundingClientRect().right + 1
              );
            }),
            "second value column is fully reachable beside sticky labels",
          );
        }
        await page.getByRole("checkbox", { name: "Only differences" }).check();
        assert.equal(
          await front()
            .getByRole("rowheader", { name: /Camber|Tie rod|Upper/ })
            .count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("heading", { name: "Electronics", exact: true })
            .count(),
          0,
        );
        assert.deepEqual(await row("Toe").getByRole("cell").allTextContents(), [
          "1",
          "2",
        ]);
        identical = true;
        await page
          .getByRole("button", { name: "Refresh comparison", exact: true })
          .click();
        await page
          .getByText("No comparable differences found.", { exact: true })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        await page
          .getByRole("checkbox", { name: "Only differences" })
          .uncheck();
        assert(
          await page
            .getByRole("heading", { name: "Electronics", exact: true })
            .isVisible(),
        );
        identical = false;
        await page
          .getByRole("button", { name: "Refresh comparison", exact: true })
          .click();
        await result().waitFor();
        await page.screenshot({
          path: `artifacts/compare-qa/public-${engine}-${width}x${height}.png`,
        });
        pairStatus = 500;
        await page
          .getByRole("button", { name: "Refresh comparison", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Unable to load comparison. Please retry." })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        assert.equal(await page.getByText(a.title, { exact: true }).count(), 0);
        pairStatus = 200;
        await page
          .getByRole("button", { name: "Retry comparison", exact: true })
          .click();
        await result().waitFor();
        const before = pairCalls.length;
        await page.reload();
        await result().waitFor();
        assert(pairCalls.length > before);
        await page.goto(origin + `/setups/${a.id}`);
        await page
          .getByRole("link", { name: "Compare to", exact: true })
          .click();
        await page
          .getByRole("region", { name: "Choose second setup", exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).searchParams.get("left_id"), a.id);
        await search("Beta");
        await page
          .getByRole("button", {
            name: "Select Beta public as second setup",
            exact: true,
          })
          .click();
        await result().waitFor();
        await page
          .getByRole("button", {
            name: "Second setup: Beta public",
            exact: true,
          })
          .click();
        await search("Private");
        await page
          .getByText("No visible setups match this search.", { exact: true })
          .waitFor();
        assert.equal(oauth, 0);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page.waitForURL(origin + "/");
        await page
          .getByRole("heading", { name: "Explore", exact: true })
          .waitFor();
        assert.equal(oauth, 1);
        await goCompare();
        await search("Private");
        await page
          .getByRole("button", {
            name: "Select Private owner setup as first setup",
            exact: true,
          })
          .click();
        await search("Alpha");
        await page
          .getByRole("button", {
            name: "Select Alpha public as second setup",
            exact: true,
          })
          .click();
        await result().waitFor();
        assert(
          await page
            .getByRole("button", {
              name: "First setup: Private owner setup",
              exact: true,
            })
            .isVisible(),
        );
        await page
          .getByRole("button", {
            name: "Second setup: Alpha public",
            exact: true,
          })
          .click();
        await search("Accepted");
        await page
          .getByRole("button", {
            name: "Select Accepted friend setup as second setup",
            exact: true,
          })
          .click();
        await result().waitFor();
        await page.screenshot({
          path: `artifacts/compare-qa/member-${engine}-${width}x${height}.png`,
        });
        accepted = false;
        await page
          .getByRole("button", { name: "Refresh comparison", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "One or both setups not found or unavailable." })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        assert.equal(await page.getByText(c.title, { exact: true }).count(), 0);
        assert.equal(await page.getByText(d.title, { exact: true }).count(), 0);
        accepted = true;
        holdNext = true;
        await page.reload();
        await page
          .getByText("Checking access to both setups…", { exact: true })
          .waitFor();
        if (mobile)
          await page
            .getByRole("button", { name: "Open account menu", exact: true })
            .click();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        release?.();
        await Promise.allSettled([...inFlight]);
        await page
          .getByRole("alert")
          .filter({ hasText: "One or both setups not found or unavailable." })
          .waitFor();
        assert.equal(await page.getByText(c.title, { exact: true }).count(), 0);
        assert.equal(await page.getByText(d.title, { exact: true }).count(), 0);
        await page.goBack();
        await page
          .getByRole("heading", { name: "Compare setups", exact: true })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        await page.goForward();
        await page
          .getByRole("alert")
          .filter({ hasText: "One or both setups not found or unavailable." })
          .waitFor();
        assert.equal(
          await page
            .getByText("never-render@example.test", { exact: true })
            .count(),
          0,
        );
        assert(
          !(await page
            .locator("body")
            .textContent()
            .then((t) => t.includes("raw database"))),
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          "comparison overflow stays inside the table",
        );
        assert(visibleCalls.some((call) => call.q === "Beta" && !call.member));
        assert(
          visibleCalls.some((call) => call.q === "Private" && call.member),
        );
        assert.deepEqual(unexpected, []);
        assert.deepEqual(errors, []);
        console.log(
          `PASS compare ${engine} ${width}x${height}: both entry points, public/own/friend selection, semantic/zero/missing differences, empty sections, keyboard scroll, direct refresh, revocation, logout/late result/history; mocked HTTP, emulated device`,
        );
      } catch (error) {
        const failed = context.pages()[0];
        if (failed) {
          console.error(
            `FAIL compare ${engine} ${width}x${height}`,
            (await failed.locator("body").textContent()).slice(0, 1200),
          );
          await failed.screenshot({
            path: `artifacts/compare-qa/failure-${engine}-${width}x${height}.png`,
          });
        }
        throw error;
      } finally {
        release();
        await Promise.allSettled([...inFlight]);
        await context.close();
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
}
