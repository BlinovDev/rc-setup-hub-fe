import { chromium, webkit, devices } from "playwright";
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
const engines = process.env.HELP_BROWSER_ENGINE
  ? [process.env.HELP_BROWSER_ENGINE]
  : ["chromium", "webkit"];
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
  for (const engine of engines) {
    assert(["chromium", "webkit"].includes(engine));
    browser = await { chromium, webkit }[engine].launch({ headless: true });
    await mkdir("artifacts/photo-qa", { recursive: true });
    for (const [width, height] of [
      [320, 900],
      [375, 900],
      [390, 900],
      [430, 932],
      [768, 900],
      [1280, 900],
      [640, 360],
    ]) {
      for (const signedIn of [false, true]) {
        const context = await browser.newContext({
          ...(engine === "webkit" && width < 768 ? devices["iPhone 13"] : {}),
          viewport: { width, height },
          hasTouch: width < 768,
        });
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(15000);
          const errors = [],
            unexpected = [];
          let oauth = 0,
            authenticated = signedIn,
            protectedReads = 0,
            logoutCount = 0;
          const privateTitle = "Private navigation setup";
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("http://127.0.0.1:8080/**", async (route) => {
            const request = route.request();
            const path = new URL(request.url()).pathname;
            const headers = {
              "access-control-allow-origin": origin,
              "access-control-allow-credentials": "true",
            };
            if (request.method() === "GET" && path === "/auth/google") {
              oauth++;
              authenticated = true;
              // WebKit route fulfillment cannot synthesize an HTTP redirect.
              // Model the fixed APP_URL return without a real OAuth provider.
              await route.fulfill({
                headers,
                contentType: "text/html",
                body: `<meta http-equiv="refresh" content="0;url=${origin}/">`,
              });
            } else if (request.method() === "GET" && path === "/api/v1/me") {
              await route.fulfill({
                status: authenticated ? 200 : 401,
                headers,
                json: authenticated
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
              request.method() === "GET" &&
              path === "/api/v1/chassis/brands"
            ) {
              await route.fulfill({ headers, json: [] });
            } else if (
              request.method() === "GET" &&
              path === "/api/v1/setups/search"
            ) {
              await route.fulfill({
                headers,
                json: { items: [], next_cursor: null },
              });
            } else if (
              request.method() === "GET" &&
              path === "/api/v1/me/setups"
            ) {
              protectedReads++;
              assert(authenticated, "guest must not request private setups");
              await route.fulfill({
                headers,
                json: [
                  {
                    id: "c61393b6-daa0-4eb8-923c-57aedbb46a47",
                    owner_id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
                    title: privateTitle,
                    visibility: "private",
                    schema_version: 1,
                    chassis_model_id: null,
                    chassis: null,
                    notes: null,
                    data: {},
                    cover_photo: null,
                    running_gear_manufacturers: null,
                    rear_differential_manufacturer: null,
                    lower_arm_mount_manufacturers: null,
                    front_steering_knuckle_manufacturer: null,
                    created_at: "2026-10-12T12:00:00Z",
                    updated_at: "2026-10-12T12:00:00Z",
                  },
                ],
              });
            } else if (
              request.method() === "GET" &&
              path === "/api/v1/friendships"
            ) {
              assert(authenticated, "guest must not request friendships");
              await route.fulfill({
                headers,
                json: { incoming: [], outgoing: [], accepted: [] },
              });
            } else if (
              request.method() === "POST" &&
              path === "/api/v1/auth/logout"
            ) {
              authenticated = false;
              logoutCount++;
              await route.fulfill({ status: 204, headers });
            } else if (request.method() === "OPTIONS") {
              await route.fulfill({
                status: 204,
                headers: {
                  ...headers,
                  "access-control-allow-methods": "GET, POST, OPTIONS",
                  "access-control-allow-headers": "content-type",
                },
              });
            } else {
              unexpected.push(`${request.method()} ${path}`);
              await route.abort();
            }
          });
          await page.goto(`${origin}${signedIn ? "/my/setups" : "/"}`);
          await page
            .getByText(
              signedIn ? privateTitle : "No public setups match these filters.",
              { exact: true },
            )
            .waitFor();
          const mobile = width < 768;
          let area;
          if (mobile) {
            const header = page.getByRole("banner");
            assert.equal(await header.getByRole("navigation").count(), 0);
            assert.equal(
              await header
                .getByRole("button", { name: "Help & Feedback" })
                .count(),
              0,
            );
            const title = await header
              .getByRole("heading", { name: "RC Setup Hub" })
              .boundingBox();
            const control = header.getByRole("button", {
              name: signedIn ? "Open account menu" : "Sign in",
              exact: true,
            });
            const controlBox = await control.boundingBox();
            assert(
              Math.abs(
                title.y +
                  title.height / 2 -
                  controlBox.y -
                  controlBox.height / 2,
              ) < 2,
              "header stays one row",
            );
            area = page.getByRole("navigation", {
              name: "Mobile navigation",
              exact: true,
            });
            await area.waitFor();
            assert(
              (
                await page
                  .locator('meta[name="viewport"]')
                  .getAttribute("content")
              ).includes("viewport-fit=cover"),
            );
            if (engine === "chromium") {
              const cdp = await context.newCDPSession(page);
              await cdp.send("Emulation.setSafeAreaInsetsOverride", {
                insets: { top: 47, bottom: 34, left: 0, right: 0 },
              });
              await page.waitForFunction(
                () =>
                  parseFloat(
                    getComputedStyle(
                      document.querySelector(".mobile-bottom-nav"),
                    ).paddingBottom,
                  ) >= 34,
              );
              assert(
                (
                  await header
                    .getByRole("heading", { name: "RC Setup Hub" })
                    .boundingBox()
                ).y >= 47,
                "branding stays below the simulated notch",
              );
              assert(
                await area.evaluate((el) => {
                  const bar = el.getBoundingClientRect();
                  return [...el.children]
                    .filter((child) => child.matches("a,button"))
                    .every(
                      (child) =>
                        child.getBoundingClientRect().bottom <= bar.bottom - 34,
                    );
                }),
                "actions stay above the simulated home indicator",
              );
            }
            const actions = area.locator(":scope > a, :scope > button");
            assert.deepEqual(await actions.allTextContents(), [
              "Explore",
              "My setups",
              signedIn ? "Friends" : "Help & Feedback",
            ]);
            const boxes = await actions.evaluateAll((elements) =>
              elements.map((el) => {
                const r = el.getBoundingClientRect();
                return {
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  wrapped:
                    el.scrollWidth > el.clientWidth ||
                    (() => {
                      const range = document.createRange();
                      range.selectNodeContents(el);
                      return (
                        range.getClientRects().length !== 1 ||
                        range.getBoundingClientRect().width > el.clientWidth
                      );
                    })(),
                };
              }),
            );
            for (const box of boxes) {
              assert.equal(
                box.y,
                boxes[0].y,
                "bottom navigation stays one row",
              );
              assert(
                box.height >= 44 &&
                  !box.wrapped &&
                  box.x >= 0 &&
                  box.x + box.width <= width + 1,
              );
            }
            assert.equal(
              await area
                .getByRole("link", { name: "My setups", exact: true })
                .getAttribute("href"),
              "/my/setups",
            );
            await area
              .getByRole("link", { name: "Explore", exact: true })
              .click();
            await page
              .getByText("No public setups match these filters.", {
                exact: true,
              })
              .waitFor();
            assert.equal(
              await area
                .getByRole("link", { name: "Explore", exact: true })
                .getAttribute("aria-current"),
              "page",
            );
            await area
              .getByRole("link", { name: "My setups", exact: true })
              .click();
            await page
              .getByRole(signedIn ? "heading" : "button", {
                name: signedIn ? "My setups" : "Sign in with Google",
                exact: true,
              })
              .waitFor();
            assert.equal(
              await area
                .getByRole("link", { name: "My setups", exact: true })
                .getAttribute("aria-current"),
              "page",
            );
            if (!signedIn) {
              assert.equal(
                await page
                  .getByRole("button", { name: "Create setup", exact: true })
                  .count(),
                0,
                "guest cannot submit creation",
              );
              assert.equal(protectedReads, 0);
              assert.equal(
                await page.getByText(privateTitle, { exact: true }).count(),
                0,
              );
            } else {
              await area
                .getByRole("link", { name: "Friends", exact: true })
                .click();
              await page
                .getByRole("heading", { name: "Friends", exact: true })
                .waitFor();
              assert.equal(
                await area
                  .getByRole("link", { name: "Friends", exact: true })
                  .getAttribute("aria-current"),
                "page",
              );
              await area
                .getByRole("link", { name: "My setups", exact: true })
                .click();
              await page.getByText(privateTitle, { exact: true }).waitFor();
            }
            await page.screenshot({
              path: `artifacts/photo-qa/nav-${engine}-${signedIn ? "member" : "guest"}-${width}x${height}.png`,
            });
            // Shrinking the layout viewport models toolbar expansion/short landscape.
            await page.setViewportSize({
              width,
              height: Math.min(height, 360),
            });
            assert(
              await area.evaluate((el) => {
                const r = el.getBoundingClientRect();
                return (
                  Math.abs(r.bottom - window.innerHeight) <= 1 && r.top >= 0
                );
              }),
            );
            await page.setViewportSize({ width, height });
            await page
              .locator("#page-content")
              .evaluate((el) => el.scrollIntoView({ block: "end" }));
            assert(
              await page.locator("#page-content").evaluate((el) => {
                const content = el.getBoundingClientRect();
                const bar = document
                  .querySelector(".mobile-bottom-nav")
                  .getBoundingClientRect();
                return (
                  content.bottom -
                    parseFloat(getComputedStyle(el).paddingBottom) <=
                  bar.top
                );
              }),
              "content scrolls clear of the fixed navigation",
            );
          } else {
            area = page.getByRole("contentinfo");
            assert.equal(
              await page
                .getByRole("navigation", {
                  name: "Mobile navigation",
                  exact: true,
                })
                .count(),
              0,
            );
            const desktopNav = page.getByRole("navigation", {
              name: signedIn ? "Main" : "Public navigation",
              exact: true,
            });
            assert.deepEqual(
              await desktopNav.getByRole("link").allTextContents(),
              signedIn
                ? ["Explore", "My setups", "Friends", "Settings", "Compare"]
                : ["Explore", "Create setup", "Compare"],
            );
          }
          if (mobile && signedIn) {
            await page
              .getByRole("button", { name: "Open account menu" })
              .click();
            const menu = page.getByRole("dialog", {
              name: "Account and navigation",
            });
            await menu.waitFor();
            assert.deepEqual(
              await menu.locator(".account-nav a").allTextContents(),
              ["Account settings", "Compare"],
            );
            await menu
              .getByRole("link", { name: "Account settings", exact: true })
              .click();
            await menu.waitFor({ state: "hidden" });
            await page
              .getByRole("heading", { name: "Settings", exact: true })
              .waitFor();
            await page
              .getByRole("button", { name: "Open account menu" })
              .click();
            area = menu;
          }
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
            path: `artifacts/photo-qa/help-${engine}-${signedIn ? "member" : "guest"}-${width}x${height}.png`,
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
              "closing nested help keeps the account drawer open",
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
              () =>
                document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          );
          assert.equal(
            oauth,
            0,
            "My setups guest gate never starts OAuth automatically",
          );
          const mobileNav = page.getByRole("navigation", {
            name: "Mobile navigation",
            exact: true,
          });
          const assertNav = async (member) => {
            if (!mobile) return;
            assert.deepEqual(
              await mobileNav
                .locator(":scope > a, :scope > button")
                .allTextContents(),
              ["Explore", "My setups", member ? "Friends" : "Help & Feedback"],
            );
          };
          const signOut = async () => {
            if (mobile)
              await page
                .getByRole("button", { name: "Open account menu" })
                .click();
            await page
              .getByRole("button", { name: "Sign out", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Sign in", exact: true })
              .waitFor();
            await assertNav(false);
            assert.equal(
              await page.getByText(privateTitle, { exact: true }).count(),
              0,
            );
            assert.equal(await page.getByRole("dialog").count(), 0);
          };
          if (signedIn) await signOut();
          const readsBeforeGuest = protectedReads;
          await page.goto(origin + "/my/setups");
          await page
            .getByRole("button", { name: "Sign in with Google" })
            .waitFor();
          assert.equal(
            protectedReads,
            readsBeforeGuest,
            "guest gate does not query private lists",
          );
          await assertNav(false);
          await page
            .getByRole("button", { name: "Sign in with Google" })
            .click();
          await page.waitForURL(origin + "/");
          await page
            .getByText("No public setups match these filters.", { exact: true })
            .waitFor();
          assert.equal(oauth, 1);
          await assertNav(true);
          const nav = mobile
            ? mobileNav
            : page.getByRole("navigation", { name: "Main", exact: true });
          await nav
            .getByRole("link", { name: "My setups", exact: true })
            .click();
          await page.getByText(privateTitle, { exact: true }).waitFor();
          await nav.getByRole("link", { name: "Explore", exact: true }).click();
          await page
            .getByText("No public setups match these filters.", { exact: true })
            .waitFor();
          await page.goBack();
          await page.getByText(privateTitle, { exact: true }).waitFor();
          await signOut();
          await page
            .getByRole("button", { name: "Sign in with Google" })
            .waitFor();
          const readsAfterLogout = protectedReads;
          await page.goForward();
          await page
            .getByText("No public setups match these filters.", { exact: true })
            .waitFor();
          await page.goBack();
          await page
            .getByRole("button", { name: "Sign in with Google" })
            .waitFor();
          await assertNav(false);
          assert.equal(
            protectedReads,
            readsAfterLogout,
            "history cannot restore protected requests after logout",
          );
          assert.equal(
            await page.getByText(privateTitle, { exact: true }).count(),
            0,
          );
          assert.equal(logoutCount, signedIn ? 2 : 1);
          assert.deepEqual(
            unexpected,
            [],
            "only the declared navigation/session fixture requests are allowed",
          );
          assert.deepEqual(errors, []);
          console.log(
            `PASS Help & Feedback ${engine} ${signedIn ? "member" : "guest"} ${width}x${height}: keyboard/modal/focus/backdrop/selectable email/mailto/layout; mocked HTTP, real browser engine`,
          );
        } finally {
          await context.close();
        }
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
