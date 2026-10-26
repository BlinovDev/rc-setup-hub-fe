import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:5174";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5174",
    "--strictPort",
  ],
  {
    env: { ...process.env, VITE_API_URL: "http://127.0.0.1:8080" },
    stdio: "ignore",
  },
);
const email = "internationaldrifthub@gmail.com";
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(origin);
      break;
    } catch {
      if (attempt === 99) throw Error("Help QA Vite unavailable");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await chromium.launch({ headless: true });
  await mkdir("artifacts/photo-qa", { recursive: true });
  for (const [width, height] of [
    [320, 900],
    [375, 900],
    [390, 900],
    [768, 900],
    [1280, 900],
    [640, 360],
  ]) {
    for (const signedIn of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width < 768,
      });
      try {
        const page = await context.newPage();
        const errors = [],
          unexpected = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("http://127.0.0.1:8080/**", async (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          const headers = {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
          };
          if (request.method() === "GET" && path === "/api/v1/me") {
            await route.fulfill({
              status: signedIn ? 200 : 401,
              headers,
              json: signedIn
                ? {
                    id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
                    nickname: "Driver",
                    email: "driver@example.test",
                    avatar_url: null,
                    created_at: "2026-10-12T12:00:00Z",
                  }
                : {},
            });
          } else if (
            signedIn &&
            request.method() === "GET" &&
            path === "/api/v1/me/setups"
          ) {
            await route.fulfill({ headers, json: [] });
          } else {
            unexpected.push(`${request.method()} ${path}`);
            await route.abort();
          }
        });
        await page.goto(`${origin}${signedIn ? "/my/setups" : "/"}`);
        await page
          .getByText(
            signedIn
              ? "No setups yet."
              : "Manage and share your RC drift setups.",
            { exact: true },
          )
          .waitFor();
        const mobile = width < 768;
        let area;
        if (mobile && signedIn) {
          await page.getByRole("button", { name: "Open account menu" }).click();
          area = page.getByRole("dialog", { name: "Account and navigation" });
          await area.waitFor();
          assert.equal(await area.getByRole("link").count(), 3);
          assert.equal(
            await area
              .getByRole("button", { name: "Sign out", exact: true })
              .count(),
            1,
          );
        } else area = page.getByRole(mobile ? "banner" : "contentinfo");
        const trigger = area.getByRole("button", {
          name: "Help & Feedback",
          exact: true,
        });
        await trigger.focus();
        await page.keyboard.press("Enter");
        const panel = page.getByRole("dialog", {
          name: "Help & Feedback",
          exact: true,
        });
        const close = panel.getByRole("button", { name: "Close help" });
        const mail = panel.getByRole("link", { name: "Send email" });
        await panel.waitFor();
        assert(await close.evaluate((el) => el === document.activeElement));
        assert.equal(await mail.getAttribute("href"), `mailto:${email}`);
        assert(
          await panel.evaluate(
            (el) =>
              !!el.getAttribute("aria-labelledby") &&
              !!el.getAttribute("aria-describedby") &&
              el.matches(":modal"),
          ),
        );
        const content = await panel.textContent();
        for (const text of [
          "creating or accessing an account",
          "technical support",
          "report a bug",
          "suggest a feature",
          "ask something else",
        ])
          assert(content.includes(text));
        await page.keyboard.press("Shift+Tab");
        assert(await mail.evaluate((el) => el === document.activeElement));
        await page.keyboard.press("Tab");
        assert(await close.evaluate((el) => el === document.activeElement));
        await page.keyboard.press("Tab");
        assert(await mail.evaluate((el) => el === document.activeElement));
        const text = panel.getByText(email, { exact: true });
        assert.equal(
          await text.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            return selection.toString();
          }),
          email,
        );
        await text.click();
        assert(
          await panel.isVisible(),
          "selecting contact text must not dismiss help",
        );
        const bounds = await panel.boundingBox();
        assert(
          bounds.x >= 0 &&
            bounds.y >= 0 &&
            bounds.x + bounds.width <= width + 1 &&
            bounds.y + bounds.height <= height + 1,
        );
        assert(
          await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          "dialog must not overflow horizontally",
        );
        for (const action of [close, mail]) {
          await action.scrollIntoViewIfNeeded();
          assert((await action.boundingBox()).height >= 44);
        }
        await page.screenshot({
          path: `artifacts/photo-qa/help-${signedIn ? "member" : "guest"}-${width}x${height}.png`,
        });
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "hidden" });
        assert(await trigger.evaluate((el) => el === document.activeElement));
        await trigger.click();
        await close.click();
        await panel.waitFor({ state: "hidden" });
        assert(await trigger.evaluate((el) => el === document.activeElement));
        await trigger.click();
        await page.mouse.click(2, 2);
        await panel.waitFor({ state: "hidden" });
        assert(await trigger.evaluate((el) => el === document.activeElement));
        if (mobile && signedIn) {
          assert(
            await area.isVisible(),
            "closing help must leave the account drawer intact",
          );
          await page.keyboard.press("Escape");
          await area.waitFor({ state: "hidden" });
          assert(
            await page
              .getByRole("button", { name: "Open account menu" })
              .evaluate((el) => el === document.activeElement),
          );
        }
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        );
        assert.deepEqual(
          unexpected,
          [],
          "help must not issue API requests or mutations",
        );
        assert.deepEqual(errors, []);
        console.log(
          `PASS Help & Feedback ${signedIn ? "member" : "guest"} ${width}x${height}: keyboard/modal/focus/backdrop/selectable email/mailto/layout; mocked HTTP, real Chromium`,
        );
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
