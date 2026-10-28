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
        const select = setupFormDriver(page).select;
        const tab = (name) => page.getByRole("tab", { name, exact: true });
        const input = (name) => page.getByLabel(name, { exact: true });
        const button = (name) =>
          page.getByRole("button", { name, exact: true });
        const standard = async (side, labels) => {
          for (const label of labels) {
            const control = input(`${side} ${label} length (mm)`);
            assert(await control.isVisible());
            assert.equal(await control.getAttribute("inputmode"), "decimal");
            assert.equal(
              await control.evaluate(
                (el) => el.closest(".component-card") === null,
              ),
              true,
            );
            assert((await control.boundingBox()).height >= 44);
          }
          assert.equal(await page.getByText(/Saved link name:/).count(), 0);
        };
        await page.goto(origin + "/my/setups/new");
        await input("Title").fill("Both views");
        await select("Front");
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        await input("Front camber (degrees)").fill("0");
        await tab("Link lengths").click();
        await standard("Front", ["Upper arm", "Lower arm", "Steering tie rod"]);
        assert.equal(await button("Remove front link 1").count(), 0);
        const upper = input("Front Upper arm length (mm)"),
          steering = input("Front Steering tie rod length (mm)");
        await upper.fill("40,5");
        await steering.fill("0");
        await tab("Angles").click();
        await button("Create setup").click();
        await page.waitForFunction(
          () =>
            document.activeElement?.getAttribute("name") ===
            "front.steering_tie_rod_length_mm",
        );
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        assert.equal(posts.length, 0);
        assert.equal(await steering.getAttribute("aria-invalid"), "true");
        await steering.fill("16,23456789");
        await button("Add front link").click();
        await input("Front link 1 name").fill("Custom A");
        await button("Add front link").click();
        await input("Front link 2 name").fill("Z brace");
        await input("Front link 2 length (mm)").fill("14,25");
        await button("Add component: Front top arm spacing").click();
        await input("Front top arm — Front spacers (mm)").fill("0");
        await input("Front top arm — Rear spacers (mm)").fill("5,2");
        await button("Done Front top arm spacing").click();
        await page.waitForFunction(
          () =>
            document.activeElement?.textContent?.trim() ===
            "Edit Front top arm spacing",
        );
        await tab("Link lengths").focus();
        await page.keyboard.press("Home");
        assert.equal(await input("Front camber (degrees)").inputValue(), "0");
        await page.keyboard.press("ArrowRight");
        assert(
          await tab("Link lengths").evaluate(
            (el) => el === document.activeElement,
          ),
        );
        await select("Rear");
        await tab("Link lengths").click();
        await standard("Rear", ["Upper arm", "Lower arm"]);
        assert.equal(await page.getByLabel(/Rear Steering tie rod/).count(), 0);
        await input("Rear Upper arm length (mm)").fill("42,123456789");
        await input("Rear Lower arm length (mm)").fill("55");
        await button("Add rear link").click();
        await input("Rear link 1 name").fill("Rear unknown");
        await select("Front");
        assert.equal(await upper.inputValue(), "40,5");
        const bounds = await page.getByRole("tab").evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              y: r.y,
              h: r.height,
              overflow: el.scrollWidth > el.clientWidth,
            };
          }),
        );
        assert.equal(bounds[0].y, bounds[1].y);
        assert(bounds.every((b) => b.h >= 44 && !b.overflow));
        await upper.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `artifacts/links-qa/tabs-${engine}-${width}x${height}.png`,
        });
        await button("Create setup").click();
        await page.getByText("Setup created.", { exact: true }).waitFor();
        assert.equal(posts.length, 1);
        assert.deepEqual(saved.data.suspension.front, {
          camber_deg: 0,
          upper_arm_length_mm: 40.5,
          steering_tie_rod_length_mm: 16.23456789,
          top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
          link_lengths: [
            { name: "Custom A" },
            { name: "Z brace", length_mm: 14.25 },
          ],
        });
        assert.deepEqual(saved.data.suspension.rear, {
          upper_arm_length_mm: 42.123456789,
          lower_arm_length_mm: 55,
          link_lengths: [{ name: "Rear unknown" }],
        });
        await page.goto(origin + `/setups/${id}`);
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        assert(
          await page.getByText("16.23456789 mm", { exact: true }).isVisible(),
        );
        assert.equal(
          await page.getByText("Not specified", { exact: true }).count(),
          3,
        );
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await select("Front");
        assert.equal(await tab("Angles").getAttribute("aria-selected"), "true");
        await tab("Link lengths").click();
        await standard("Front", ["Upper arm", "Lower arm", "Steering tie rod"]);
        assert.equal(await upper.inputValue(), "40.5");
        await upper.fill("");
        await input("Front link 1 name").fill("Renamed brace");
        await button("Remove front link 2").click();
        await button("Cancel").click();
        assert.equal(await input("Front link 2 name").inputValue(), "Z brace");
        await button("Remove front link 2").click();
        await button("Confirm remove front link 2").click();
        await button("Edit Front top arm spacing").click();
        assert.equal(
          await input("Front top arm — Front spacers (mm)").inputValue(),
          "0",
        );
        assert.equal(
          await input("Front top arm — Rear spacers (mm)").inputValue(),
          "5.2",
        );
        await button("Remove Front top arm spacing").click();
        await button("Cancel").click();
        await button("Done Front top arm spacing").click();
        await select("Rear");
        assert.equal(
          await tab("Link lengths").getAttribute("aria-selected"),
          "true",
        );
        await button("Save setup").click();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        assert.equal(patches.length, 1);
        assert.equal(
          saved.data.suspension.front.upper_arm_length_mm,
          undefined,
        );
        assert.deepEqual(saved.data.suspension.front.link_lengths, [
          { name: "Renamed brace" },
        ]);
        assert.deepEqual(saved.data.suspension.front.top_arm_spacing, {
          front_mm: 0,
          rear_mm: 5.2,
        });
        const legacy = {
          suspension: {
            front: {
              link_lengths: [
                { name: "upper_arm", length_mm: 42.5 },
                { name: "lower_arm", length_mm: 20 },
                { name: "lower_arm", length_mm: 21 },
                { name: "Upper", length_mm: 60 },
                { name: "Legacy custom", length_mm: null },
                { name: "Front named", length_mm: 10.2 },
              ],
              top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
            },
            rear: {
              link_lengths: [
                { name: "steering_tie_rod", length_mm: 18.5 },
                { name: "lower_arm", length_mm: 47 },
              ],
              lower_arm_spacing: { rear_mm: 0 },
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
          await input("Front Lower arm length (mm)").inputValue(),
          "",
        );
        assert.equal(await input("Front link 4 name").inputValue(), "Upper");
        assert.equal(
          await input("Front link 2 name").inputValue(),
          "lower_arm",
        );
        assert.equal(
          await input("Front link 3 name").inputValue(),
          "lower_arm",
        );
        assert.equal(await input("Front link 1 name").count(), 0);
        await select("General");
        await input("Title").fill("Legacy title-only edit");
        await button("Save setup").click();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        const normalized = structuredClone(legacy);
        delete normalized.suspension.front.link_lengths[4].length_mm;
        assert.deepEqual(saved.data, normalized);
        // Historical zero is readable but cannot be newly saved as a length.
        // Correct it through the fixed input without validating the removed row.
        saved.data.suspension.front.link_lengths[0].length_mm = 0;
        await page.goto(origin + `/my/setups/${id}/edit`);
        await select("Front");
        assert.equal(await upper.inputValue(), "0");
        await tab("Angles").click();
        await button("Save setup").click();
        await page.waitForFunction(
          () =>
            document.activeElement?.getAttribute("name") ===
            "front.upper_arm_length_mm",
        );
        assert.equal(patches.length, 2);
        await upper.fill("43,5");
        await select("Rear");
        assert.equal(
          await input("Rear Lower arm length (mm)").inputValue(),
          "47",
        );
        await input("Rear Lower arm length (mm)").fill("");
        await button("Save setup").click();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        const converted = structuredClone(normalized);
        converted.suspension.front.upper_arm_length_mm = 43.5;
        converted.suspension.front.link_lengths.shift();
        converted.suspension.rear.link_lengths.pop();
        assert.deepEqual(saved.data, converted);
        assert.equal(patches.length, 3);
        other = {
          ...saved,
          id: otherId,
          title: "Other setup",
          visibility: "public",
          data: structuredClone(saved.data),
        };
        other.data.suspension.front.upper_arm_length_mm = 42.5;
        other.data.suspension.front.link_lengths.reverse();
        other.data.suspension.front.link_lengths.find(
          (l) => l.name === "Front named",
        ).length_mm = 11.2;
        other.data.suspension.front.link_lengths.find(
          (l) => l.name === "Legacy custom",
        ).length_mm = 20;
        await page.goto(origin + `/compare?left_id=${id}&right_id=${otherId}`);
        await page
          .getByRole("heading", { name: "Setup comparison", exact: true })
          .waitFor();
        const front = () =>
          page.getByRole("region", { name: "Front suspension", exact: true });
        const row = (name) =>
          front()
            .getByRole("rowheader")
            .filter({ hasText: name })
            .locator("..");
        assert.deepEqual(
          await row("Upper arm (mm)").getByRole("cell").allTextContents(),
          ["43.5", "42.5"],
        );
        assert.deepEqual(
          await row("Lower arm (mm)").getByRole("cell").allTextContents(),
          ["Not specified", "Not specified"],
        );
        assert.deepEqual(
          await row("Legacy custom (mm)").getByRole("cell").allTextContents(),
          ["Not specified", "20"],
        );
        await page
          .getByRole("checkbox", { name: "Only differences", exact: true })
          .check();
        assert.equal(await front().getByRole("rowheader").count(), 2);
        assert.equal(
          await page
            .getByRole("heading", { name: "Rear suspension", exact: true })
            .count(),
          0,
        );
        saved.data.suspension.front.upper_arm_length_mm = 0;
        other.data.suspension.front.upper_arm_length_mm = 1;
        other.data.suspension.front.link_lengths = structuredClone(
          saved.data.suspension.front.link_lengths,
        );
        await button("Refresh comparison").click();
        await page
          .getByRole("heading", { name: "Setup comparison", exact: true })
          .waitFor();
        await row("Upper arm (mm)")
          .getByRole("cell", { name: "0", exact: true })
          .waitFor();
        assert.deepEqual(
          await row("Upper arm (mm)").getByRole("cell").allTextContents(),
          ["0", "1"],
        );
        other.data = structuredClone(saved.data);
        await button("Refresh comparison").click();
        await page
          .getByText("No comparable differences found.", { exact: true })
          .waitFor();
        assert.equal(await page.getByRole("table").count(), 0);
        if (width < 768) await button("Open account menu").click();
        await button("Sign out").click();
        await button("Sign in").waitFor();
        await page
          .getByRole("alert")
          .filter({ hasText: "One or both setups not found or unavailable." })
          .waitFor();
        assert.equal(
          await page.getByText(saved.title, { exact: true }).count(),
          0,
        );
        saved.visibility = "public";
        await button("Retry comparison").click();
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
        assert.equal(patches.length, 3);
        assert.equal(posts.length, 1);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        console.log(
          `PASS suspension links ${engine} ${width}x${height}: fixed blank inputs, tabs/keyboard/hidden errors, typed+custom create/edit, exact legacy preservation/conversion, unchanged spacing, detail/Compare missing/zero/empty/logout`,
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
