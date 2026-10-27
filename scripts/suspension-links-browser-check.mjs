import { chromium, webkit, devices } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { setupFormDriver } from "./setup-form-driver.mjs";
const origin = "http://127.0.0.1:5177",
  api = "http://127.0.0.1:8084";
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5177",
    "--strictPort",
  ],
  { env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" },
);
const user = {
  id: "99999999-9999-4999-8999-999999999999",
  nickname: "Pilot",
  email: "hidden@example.test",
  avatar_url: null,
  created_at: "2026-10-01T12:00:00Z",
};
const id = "11111111-1111-4111-8111-111111111111",
  otherId = "22222222-2222-4222-8222-222222222222";
const base = {
  id,
  owner_id: user.id,
  title: "Link setup",
  visibility: "private",
  data: {},
  notes: null,
  schema_version: 1,
  chassis: null,
  chassis_model_id: null,
  cover_photo: null,
  running_gear_manufacturers: null,
  lower_arm_mount_manufacturers: null,
  front_steering_knuckle_manufacturer: null,
  rear_differential_manufacturer: null,
  created_at: user.created_at,
  updated_at: user.created_at,
};
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin);
      break;
    } catch {
      if (i === 99) throw Error("Links Vite unavailable");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await mkdir("artifacts/links-qa", { recursive: true });
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
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const unexpected = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let member = true,
        saved = structuredClone(base),
        other = {
          ...structuredClone(base),
          id: otherId,
          title: "Other setup",
          visibility: "public",
        },
        posts = [],
        patches = [];
      try {
        const headers = {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
        };
        await page.route(api + "/**", async (route) => {
          const r = route.request(),
            u = new URL(r.url()),
            p = u.pathname;
          if (r.method() === "OPTIONS")
            return route.fulfill({
              status: 204,
              headers: {
                ...headers,
                "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
                "access-control-allow-headers": "content-type",
              },
            });
          if (p === "/api/v1/me")
            return route.fulfill({
              status: member ? 200 : 401,
              headers,
              json: member ? user : {},
            });
          if (p === "/api/v1/auth/logout" && r.method() === "POST") {
            member = false;
            return route.fulfill({ status: 204, headers });
          }
          if (p === "/api/v1/chassis/brands")
            return route.fulfill({ headers, json: [] });
          if (p === "/api/v1/me/setups")
            return route.fulfill({ headers, json: [saved] });
          if (p === "/api/v1/setups" && r.method() === "POST") {
            assert(member);
            const body = r.postDataJSON();
            posts.push(body);
            saved = { ...base, ...body };
            return route.fulfill({ status: 201, headers, json: saved });
          }
          if (p === `/api/v1/setups/${id}`) {
            if (r.method() === "PATCH") {
              assert(member);
              const body = r.postDataJSON();
              patches.push(body);
              saved = { ...saved, ...body };
            }
            return route.fulfill({ headers, json: saved });
          }
          if (p === `/api/v1/users/${user.id}`)
            return route.fulfill({
              headers,
              json: { id: user.id, nickname: user.nickname, avatar_url: null },
            });
          if (p === `/api/v1/setups/${id}/photos`)
            return route.fulfill({ headers, json: [] });
          if (p === "/api/v1/setups/compare")
            return route.fulfill({
              status: !member && saved.visibility !== "public" ? 404 : 200,
              headers,
              json:
                !member && saved.visibility !== "public"
                  ? {}
                  : { left: saved, right: other },
            });
          unexpected.push(`${r.method()} ${p}`);
          return route.abort();
        });
        const driver = setupFormDriver(page),
          select = driver.select;
        const tab = (name) => page.getByRole("tab", { name, exact: true });
        await page.goto(origin + "/my/setups/new");
        await page.getByLabel("Title", { exact: true }).fill("Both views");
        await select("Front");
        assert.equal(await page.getByRole("tab").count(), 2);
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        await page
          .getByLabel("Front camber (degrees)", { exact: true })
          .fill("0");
        await tab("Link lengths").click();
        const upper = page.getByLabel("Front Upper arm length (mm)", {
          exact: true,
        });
        await upper.fill("40,5");
        const steering = page.getByLabel("Front Steering tie rod length (mm)", {
          exact: true,
        });
        await steering.fill("0");
        await tab("Angles").click();
        await page
          .getByRole("button", { name: "Create setup", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.activeElement?.getAttribute("name") ===
            "front.link_lengths.1.length_mm",
        );
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        assert.equal(posts.length, 0);
        assert.equal(await steering.getAttribute("aria-invalid"), "true");
        await steering.fill("16,23456789");
        await page
          .getByRole("button", { name: "Add front link", exact: true })
          .click();
        await page
          .getByLabel("Front link 3 name", { exact: true })
          .fill("Custom A");
        await page
          .getByRole("button", { name: "Add front link", exact: true })
          .click();
        await page
          .getByLabel("Front link 4 name", { exact: true })
          .fill("Z brace");
        await page
          .getByLabel("Front link 4 length (mm)", { exact: true })
          .fill("14,25");
        await tab("Link lengths").focus();
        await page.keyboard.press("Home");
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        assert.equal(
          await page
            .getByLabel("Front camber (degrees)", { exact: true })
            .inputValue(),
          "0",
        );
        await page.keyboard.press("ArrowRight");
        assert(
          await tab("Link lengths").evaluate(
            (el) => el === document.activeElement,
          ),
        );
        await select("Rear");
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        await tab("Link lengths").click();
        assert.equal(await page.getByLabel(/Rear Steering tie rod/).count(), 0);
        await page
          .getByLabel("Rear Lower arm length (mm)", { exact: true })
          .fill("55");
        await page
          .getByLabel("Rear Upper arm length (mm)", { exact: true })
          .fill("42,123456789");
        await page
          .getByRole("button", { name: "Add rear link", exact: true })
          .click();
        await page
          .getByLabel("Rear link 3 name", { exact: true })
          .fill("Rear unknown");
        await select("Front");
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        assert.equal(await upper.inputValue(), "40,5");
        const bounds = await page.getByRole("tab").evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              y: r.y,
              h: r.height,
              w: r.width,
              overflow: el.scrollWidth > el.clientWidth,
            };
          }),
        );
        assert.equal(bounds[0].y, bounds[1].y);
        assert(bounds.every((b) => b.h >= 44 && !b.overflow));
        const savedName = page.getByText("Saved link name: upper_arm", {
          exact: true,
        });
        assert((await savedName.boundingBox()).height >= 44);
        await savedName.focus();
        await page.keyboard.press("Enter");
        assert(
          await page
            .getByLabel("Front link 1 name", { exact: true })
            .isVisible(),
        );
        await page.keyboard.press("Enter");
        assert(
          !(await page
            .getByLabel("Front link 1 name", { exact: true })
            .isVisible()),
        );
        await page.screenshot({
          path: `artifacts/links-qa/tabs-${engine}-${width}x${height}.png`,
        });
        await page
          .getByRole("button", { name: "Create setup", exact: true })
          .click();
        await page.getByText("Setup created.", { exact: true }).waitFor();
        assert.equal(posts.length, 1);
        assert.deepEqual(saved.data.suspension.front, {
          camber_deg: 0,
          link_lengths: [
            { name: "upper_arm", length_mm: 40.5 },
            { name: "steering_tie_rod", length_mm: 16.23456789 },
            { name: "Custom A" },
            { name: "Z brace", length_mm: 14.25 },
          ],
        });
        assert.deepEqual(saved.data.suspension.rear, {
          link_lengths: [
            { name: "lower_arm", length_mm: 55 },
            { name: "upper_arm", length_mm: 42.123456789 },
            { name: "Rear unknown" },
          ],
        });
        await page.goto(origin + `/setups/${id}`);
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        assert(
          await page
            .getByText("Steering tie rod:", { exact: true })
            .isVisible(),
        );
        assert(
          await page.getByText("16.23456789 mm", { exact: true }).isVisible(),
        );
        assert.equal(
          await page.getByText("Not specified", { exact: true }).count(),
          2,
        );
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await select("Front");
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        await tab("Link lengths").click();
        assert.equal(await upper.inputValue(), "40.5");
        assert.equal(
          await page
            .getByLabel("Front link 3 length (mm)", { exact: true })
            .inputValue(),
          "",
        );
        await page
          .getByLabel("Front link 3 name", { exact: true })
          .fill("Renamed brace");
        await upper.fill("");
        await page
          .getByRole("button", { name: "Remove front link 4", exact: true })
          .click();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(
          await page
            .getByLabel("Front link 4 name", { exact: true })
            .inputValue(),
          "Z brace",
        );
        await page
          .getByRole("button", { name: "Remove front link 4", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Confirm remove front link 4",
            exact: true,
          })
          .click();
        await select("Rear");
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        await page
          .getByRole("button", { name: "Save setup", exact: true })
          .click();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        assert.equal(patches.length, 1);
        assert.deepEqual(saved.data.suspension.front.link_lengths, [
          { name: "upper_arm" },
          { name: "steering_tie_rod", length_mm: 16.23456789 },
          { name: "Renamed brace" },
        ]);
        const legacy = {
          suspension: {
            front: {
              link_lengths: [
                { name: "Upper", length_mm: 42.5 },
                { name: "upper_arm", length_mm: 43.5 },
                { name: "Legacy custom", length_mm: null },
                { name: "Front named", length_mm: 10.2 },
              ],
            },
            rear: {
              link_lengths: [
                { name: "steering_tie_rod", length_mm: 18.5 },
                { name: "lower_arm", length_mm: 47 },
              ],
            },
          },
          running_gear: { front: { hex: { offset_mm: 0 } } },
          shocks: { front: { oil_cst: 100, piston: { holes: 3 } } },
          electronics: { motor: "10.5T" },
        };
        saved = {
          ...base,
          title: "Legacy preserved",
          data: structuredClone(legacy),
        };
        await page.goto(origin + `/my/setups/${id}/edit`);
        await select("Front");
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        assert.equal(await upper.inputValue(), "42.5");
        assert.equal(
          await page
            .getByLabel("Front link 2 name", { exact: true })
            .inputValue(),
          "upper_arm",
        );
        assert.equal(
          await page
            .getByLabel("Front link 3 length (mm)", { exact: true })
            .inputValue(),
          "",
        );
        await tab("Angles").click();
        assert.equal(
          await page
            .getByLabel("Front toe (degrees)", { exact: true })
            .inputValue(),
          "",
        );
        await select("Rear");
        assert.equal(
          await page
            .getByLabel("Rear link 1 name", { exact: true })
            .inputValue(),
          "steering_tie_rod",
        );
        await select("General");
        await page
          .getByLabel("Title", { exact: true })
          .fill("Legacy title-only edit");
        await page
          .getByRole("button", { name: "Save setup", exact: true })
          .click();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        const normalized = structuredClone(legacy);
        delete normalized.suspension.front.link_lengths[2].length_mm;
        assert.deepEqual(saved.data, normalized);
        assert.equal(patches.length, 2);
        other = {
          ...saved,
          id: otherId,
          title: "Other setup",
          visibility: "public",
          data: structuredClone(saved.data),
        };
        other.data.suspension.front.link_lengths = [
          { name: "upper_arm", length_mm: 43.5 },
          { name: "Upper arm", length_mm: 42.5 },
          { name: "Front named", length_mm: 11.2 },
          { name: "Legacy custom", length_mm: 20 },
          { name: "steering_tie_rod" },
        ];
        await page.goto(origin + `/compare?left_id=${id}&right_id=${otherId}`);
        await page
          .getByRole("heading", { name: "Setup comparison", exact: true })
          .waitFor();
        const front = () =>
          page.getByRole("region", { name: "Front suspension", exact: true });
        const missing = front()
          .getByRole("rowheader", { name: /Legacy custom/ })
          .locator("..");
        assert.deepEqual(await missing.getByRole("cell").allTextContents(), [
          "Not specified",
          "20",
        ]);
        await page
          .getByRole("checkbox", { name: "Only differences", exact: true })
          .check();
        assert.equal(await front().getByRole("rowheader").count(), 1);
        assert(
          await front()
            .getByRole("rowheader", { name: /Front named/ })
            .isVisible(),
        );
        assert.equal(
          await page
            .getByRole("heading", { name: "Rear suspension", exact: true })
            .count(),
          0,
        );
        other.data = structuredClone(saved.data);
        await page
          .getByRole("button", { name: "Refresh comparison", exact: true })
          .click();
        await page
          .getByText("No comparable differences found.", { exact: true })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        await page
          .getByRole("checkbox", { name: "Only differences", exact: true })
          .uncheck();
        assert(
          await page
            .getByRole("heading", { name: "Rear suspension", exact: true })
            .isVisible(),
        );
        if (width < 768)
          await page
            .getByRole("button", { name: "Open account menu", exact: true })
            .click();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .waitFor();
        await page
          .getByRole("alert")
          .filter({ hasText: "One or both setups not found or unavailable." })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        assert.equal(
          await page.getByText(saved.title, { exact: true }).count(),
          0,
        );
        saved.visibility = "public";
        await page
          .getByRole("button", { name: "Retry comparison", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Setup comparison", exact: true })
          .waitFor();
        await page
          .getByRole("checkbox", { name: "Only differences", exact: true })
          .check();
        await page
          .getByText("No comparable differences found.", { exact: true })
          .waitFor();
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        console.log(
          `PASS suspension links ${engine} ${width}x${height}: tabs/keyboard/hidden errors, standard+custom optional links, create/edit/rename/remove, legacy full-data preservation, detail and authorized Compare/empty differences/logout`,
        );
      } catch (error) {
        console.error(
          `FAIL links ${engine} ${width}x${height}`,
          (await page.locator("body").textContent()).slice(0, 1200),
        );
        await page.screenshot({
          path: `artifacts/links-qa/failure-${engine}-${width}x${height}.png`,
        });
        throw error;
      } finally {
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
