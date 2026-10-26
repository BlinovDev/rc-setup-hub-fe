import { setupFormDriver } from "./setup-form-driver.mjs";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
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
await mkdir("artifacts/photo-qa", { recursive: true });
const shapes = await Promise.all(
  [
    ["portrait-3-4", 300, 400],
    ["portrait-9-16", 900, 1600],
    ["square", 400, 400],
    ["landscape-4-3", 400, 300],
    ["landscape-16-9", 1600, 900],
    ["tiny", 7, 4],
  ].map(async ([name, width, height]) => ({
    name,
    width,
    height,
    bytes: await readFile(`scripts/fixtures/photo-shapes/${name}.jpg`),
  })),
);
const center = (p) => {
  const size = Math.min(p.width, p.height);
  return {
    x: Math.floor((p.width - size) / 2),
    y: Math.floor((p.height - size) / 2),
    size,
  };
};
const scenarios = process.env.PHOTO_BROWSER_SCENARIO
  ? [process.env.PHOTO_BROWSER_SCENARIO]
  : ["lifecycle", "compact-edit"];
assert(
  scenarios.every((name) => ["lifecycle", "compact-edit"].includes(name)),
  "Unknown PHOTO_BROWSER_SCENARIO",
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
  // Keep fixture rendering independent of app navigation and cancelled media reads.
  const mediaRenderer = await browser.newPage();
  const runScenario = async (scenario, width, height) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 768,
    });
    await context.addCookies([
      {
        name: "rc_session",
        value: "photo-smoke",
        url: "http://127.0.0.1:8080",
      },
    ]);
    const page = await context.newPage();
    const pendingRoutes = new Set();
    const mobile = width < 768;
    const cropDialog = page.getByRole("dialog", { name: "Adjust thumbnail" });
    try {
      page.on("dialog", (dialog) => dialog.accept()); // Full-page test navigation explicitly discards local drafts.
      const {
        field: formField,
        button: formButton,
        group: formGroup,
        select: selectSection,
      } = setupFormDriver(page);
      // Legacy data regressions intentionally reopen the owner editor after each
      // successful save. First prove the real new exit behavior; never bypass it.
      const savedAndReopen = async () => {
        await page.waitForURL(`**/setups/${id}`);
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        await page
          .getByLabel("Title", { exact: true })
          .waitFor({ state: "detached" });
        assert.equal(
          await page.getByLabel("Title", { exact: true }).count(),
          0,
        );
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await page.getByLabel("Title", { exact: true }).waitFor();
      };

      const user = {
        id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
        nickname: "Driver",
        email: "driver@example.test",
        avatar_url: null,
        created_at: "2026-10-12T12:00:00Z",
      };
      const id = "c61393b6-daa0-4eb8-923c-57aedbb46a47";
      const manufacturerId = "33333333-3333-4333-8333-333333333333";
      const manufacturerName =
        "Historical differential manufacturer " + "long-name-".repeat(10);
      const mountModel = "Mount-".repeat(30) + "😀";
      const mountNotes = "配置 A\nMount B " + "configuration-".repeat(40);
      const mountDisplays = (data) => {
        const front = data?.suspension?.front?.lower_arm_mount?.manufacturer_id;
        const rear = data?.suspension?.rear?.lower_arm_mount?.manufacturer_id;
        return front || rear
          ? {
              front: front ? { id: front, name: manufacturerName } : null,
              rear: rear ? { id: rear, name: manufacturerName } : null,
            }
          : null;
      };
      const gearDisplays = (data) => {
        const result = { front: null, rear: null };
        for (const side of ["front", "rear"]) {
          const axle = { wheel: null, tire: null };
          for (const part of ["wheel", "tire"]) {
            const id = data?.running_gear?.[side]?.[part]?.manufacturer_id;
            if (id) axle[part] = { id, name: manufacturerName };
          }
          if (axle.wheel || axle.tire) result[side] = axle;
        }
        return result.front || result.rear ? result : null;
      };
      const gearModel = "Wheel-" + "😀".repeat(160);
      const knuckleDescription = "Part-".repeat(35) + "\nFront alloy";
      const differentialModel = "Diff-".repeat(35);
      const differentialNotes = "Oil 10000\nTwo gears " + "tuning-".repeat(45);
      let manufacturerActive = true;
      let setupPatches = 0;
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
        front_steering_knuckle_manufacturer: null,
        rear_differential_manufacturer: null,
        lower_arm_mount_manufacturers: null,
        running_gear_manufacturers: null,
        data: {
          suspension: {
            front: { top_arm_spacing: { front_mm: 0, rear_mm: 5.2 } },
          },
        },
        created_at: user.created_at,
        updated_at: user.created_at,
      };
      if (scenario === "compact-edit") {
        // Explicit independent document, not the output of the photo lifecycle suite.
        setup = {
          ...setup,
          title: "Compact edit fixture",
          notes: "Saved notes",
          data: {
            front_steering_knuckle: { description: "Historical knuckle" },
            rear_differential: { type: "spool", tuning_notes: "Saved tuning" },
            suspension: {
              front: {
                camber_deg: 0,
                toe_deg: -0.125,
                top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
                link_lengths: [{ name: "Upper", length_mm: 25 }],
              },
              rear: { caster_deg: 2, lower_arm_mount: { model: "Rear mount" } },
            },
            shocks: {
              front: {
                model: "Front shock",
                oil_cst: 100,
                piston: { holes: 6, hole_diameter_mm: 1.2 },
                seal: { type: "o-ring" },
              },
              rear: { model: "Rear shock", spring: { color: "Red" } },
            },
            running_gear: {
              front: {
                wheel: { model: "Saved wheel", offset_mm: 0 },
                tire: { model: "Front tire" },
              },
              rear: {
                wheel: { model: "Rear wheel", offset_mm: -2 },
                tire: { model: "Partial tire" },
              },
            },
            electronics: { motor: "10.5T", esc: "Saved ESC" },
          },
        };
      }
      let photos = [];
      let creates = 0;
      let uploadCalls = 0;
      let uploadGate = null;
      let fail = true;
      let cropWrites = 0;
      let cropFailure = 0;
      let mediaFailure = 0;
      let metadataReads = 0;
      let mutationCalls = 0;
      const otherOwner = "22222222-2222-4222-8222-222222222222";
      const mediaReads = new Map();
      const fixtureFor = (p) =>
        shapes[(Number(p.id.slice(-12)) - 1) % shapes.length];
      const photo = (n) => {
        const shape = shapes[(n - 1) % shapes.length];
        return {
          id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
          setup_id: id,
          width: shape.width,
          height: shape.height,
          crop: center(shape),
          thumbnail_revision: 1,
          thumbnail_width: Math.min(shape.width, shape.height, 640),
          thumbnail_height: Math.min(shape.width, shape.height, 640),
          content_type: "image/jpeg",
          is_cover: n === 1,
          created_at: user.created_at,
          url: `/api/v1/setups/${id}/photos/${n}/image`,
          thumbnail_url: `/api/v1/setups/${id}/photos/${n}/thumbnail`,
        };
      };
      async function thumbnailBytes(p) {
        const jpeg = await mediaRenderer.evaluate(
          async ({ source, crop }) => {
            const image = new Image();
            image.src = source;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = Math.min(crop.size, 640);
            canvas
              .getContext("2d")
              .drawImage(
                image,
                crop.x,
                crop.y,
                crop.size,
                crop.size,
                0,
                0,
                canvas.width,
                canvas.height,
              );
            return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
          },
          {
            source: `data:image/jpeg;base64,${fixtureFor(p).bytes.toString("base64")}`,
            crop: p.crop ?? center(p),
          },
        );
        return Buffer.from(jpeg, "base64");
      }
      const handleApiRoute = async (route) => {
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
        if (req.method() !== "GET") mutationCalls++;
        let body,
          status = 200;
        if (path === "/api/v1/me") body = user;
        else if (path === "/api/v1/chassis/brands")
          body = manufacturerActive
            ? [{ id: manufacturerId, name: manufacturerName }]
            : [];
        else if (path === "/api/v1/friendships")
          body = { incoming: [], outgoing: [], accepted: [] };
        else if (path === `/api/v1/users/${otherOwner}`)
          body = { id: otherOwner, nickname: "Other owner", avatar_url: null };
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
                owner: {
                  id: user.id,
                  nickname: user.nickname,
                  avatar_url: null,
                },
              },
            ],
            next_cursor: null,
          };
        else if (path === "/api/v1/setups" && req.method() === "POST") {
          creates++;
          setup = {
            ...setup,
            ...req.postDataJSON(),
            lower_arm_mount_manufacturers: mountDisplays(
              req.postDataJSON().data,
            ),
            running_gear_manufacturers: gearDisplays(req.postDataJSON().data),
            front_steering_knuckle_manufacturer: {
              id: manufacturerId,
              name: manufacturerName,
            },
            rear_differential_manufacturer: {
              id: manufacturerId,
              name: manufacturerName,
            },
          };
          assert.deepEqual(setup.data.running_gear, {
            front: {
              hex: { offset_mm: 0 },
              wheel: {
                manufacturer_id: manufacturerId,
                model: gearModel,
                offset_mm: -4,
              },
              tire: { manufacturer_id: manufacturerId, model: "Tire model" },
            },
            rear: {
              hex: { offset_mm: -2.123456789 },
              wheel: {
                manufacturer_id: manufacturerId,
                model: gearModel,
                offset_mm: 0,
              },
              tire: { manufacturer_id: manufacturerId, model: "Tire model" },
            },
          });
          for (const axle of ["front", "rear"]) {
            assert.deepEqual(setup.data.suspension[axle].lower_arm_mount, {
              manufacturer_id: manufacturerId,
              model: mountModel,
              configuration_notes: mountNotes,
            });
          }
          assert.deepEqual(setup.data.front_steering_knuckle, {
            manufacturer_id: manufacturerId,
            description: knuckleDescription,
          });
          assert.deepEqual(setup.data.rear_differential, {
            type: "gear",
            manufacturer_id: manufacturerId,
            model: differentialModel,
            tuning_notes: differentialNotes,
          });
          body = setup;
          status = 201;
        } else if (path === `/api/v1/setups/${id}`) {
          if (req.method() === "PATCH") {
            setupPatches++;
            const update = req.postDataJSON();
            setup = {
              ...setup,
              ...update,
              lower_arm_mount_manufacturers: mountDisplays(update.data),
              running_gear_manufacturers: gearDisplays(update.data),
              front_steering_knuckle_manufacturer: update.data
                ?.front_steering_knuckle?.manufacturer_id
                ? { id: manufacturerId, name: manufacturerName }
                : null,
              rear_differential_manufacturer: update.data?.rear_differential
                ?.manufacturer_id
                ? { id: manufacturerId, name: manufacturerName }
                : null,
            };
          }
          body = setup;
        } else if (path === `/api/v1/setups/${id}/photos`) {
          if (req.method() === "POST") {
            uploadCalls++;
            if (uploadGate) await uploadGate;
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
          } else {
            metadataReads++;
            body = photos;
          }
        } else if (path.endsWith("/crop")) {
          const target = path.split("/").at(-2);
          const update = req.postDataJSON();
          const current = photos.find((p) => p.id === target);
          if (cropFailure) {
            await route.fulfill({
              status: cropFailure,
              headers,
              contentType: "application/json",
              body: JSON.stringify({ error: "crop failed" }),
            });
            return;
          }
          assert.equal(update.expected_revision, current.thumbnail_revision);
          const crop = update.crop ?? center(current);
          assert(
            Number.isInteger(crop.x) &&
              Number.isInteger(crop.y) &&
              Number.isInteger(crop.size),
          );
          assert(
            crop.x >= 0 &&
              crop.y >= 0 &&
              crop.x + crop.size <= current.width &&
              crop.y + crop.size <= current.height,
          );
          cropWrites++;
          photos = photos.map((p) =>
            p.id === target
              ? {
                  ...p,
                  crop,
                  thumbnail_revision: p.thumbnail_revision + 1,
                  thumbnail_width: Math.min(crop.size, 640),
                  thumbnail_height: Math.min(crop.size, 640),
                }
              : p,
          );
          setup = {
            ...setup,
            cover_photo: photos.find((p) => p.is_cover) ?? null,
          };
          body = photos.find((p) => p.id === target);
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
          const target = photos.find((p) => p.id === path.split("/").at(-2));
          assert(target, "media must belong to an existing photo");
          const isThumbnail = path.endsWith("/thumbnail");
          if (mediaFailure) {
            await route.fulfill({
              status: mediaFailure,
              headers,
              contentType: "application/json",
              body: JSON.stringify({ error: "unavailable" }),
            });
            return;
          }
          mediaReads.set(target.id, (mediaReads.get(target.id) ?? 0) + 1);
          await route.fulfill({
            headers,
            contentType: "image/jpeg",
            body: isThumbnail
              ? await thumbnailBytes(target)
              : fixtureFor(target).bytes,
          });
          return;
        } else throw Error(`Unhandled ${req.method()} ${path}`);
        await route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      };
      await page.route("http://127.0.0.1:8080/**", async (route) => {
        const task = handleApiRoute(route);
        pendingRoutes.add(task);
        try {
          await task;
        } finally {
          pendingRoutes.delete(task);
        }
      });
      const geometry = async () =>
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}px horizontal overflow`,
        );
      const assertFocusAboveActions = async (label) => {
        const rect = await page
          .getByLabel(label, { exact: true })
          .boundingBox();
        assert(
          rect &&
            rect.height >= 44 &&
            rect.y >= 0 &&
            rect.y + rect.height <= height,
          "focused field must fit the viewport and retain a 44px target",
        );
        if (width < 768) {
          const actions = await page.locator(".form-actions").boundingBox();
          assert(
            actions && rect.y + rect.height <= actions.y,
            "focused field must remain above fixed Save/navigation controls",
          );
        }
      };
      if (scenario === "lifecycle") {
        await page.goto("http://127.0.0.1:5173/my/setups");
        await page.getByAltText("No setup photo — placeholder").waitFor();
        // Visibility does not guarantee decoding has completed on a fresh context.
        await page
          .getByAltText("No setup photo — placeholder")
          .evaluate((img) => img.decode());
        assert.equal(
          await page
            .getByAltText("No setup photo — placeholder")
            .evaluate((img) => img.naturalWidth),
          600,
        );
        await geometry();
        const placeholderLink = page.getByRole("link", {
          name: `View ${setup.title}`,
          exact: true,
        });
        assert.equal(
          await placeholderLink.getAttribute("href"),
          `/setups/${id}`,
        );
        await placeholderLink.click();
        await page
          .getByRole("heading", { name: setup.title, exact: true })
          .waitFor();
        assert.equal(
          await (await formField("Title", { exact: true })).count(),
          0,
        );
        assert.equal(
          await (
            await formButton({ name: "Choose photos", exact: true })
          ).count(),
          0,
        );
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await (await formField("Title", { exact: true })).waitFor();
        assert.equal(
          await (await formField("Title", { exact: true })).inputValue(),
          setup.title,
        );
        assert.equal(mutationCalls, 0);
        await page.goto("http://127.0.0.1:5173/my/setups/new");
        // Phase 4: exercise the approved disclosure contract without the legacy driver.
        await page
          .getByLabel("Title", { exact: true })
          .waitFor({ state: "visible" });
        if (width === 1280) {
          await page
            .locator(".setup-editor")
            .evaluate((el) => (el.style.zoom = "2"));
          await geometry();
          await page
            .getByLabel("Title", { exact: true })
            .fill("200 percent form zoom");
          await page.screenshot({
            path: "artifacts/photo-qa/ux-200-percent-form-zoom.png",
            fullPage: true,
          });
          await page.getByLabel("Title", { exact: true }).fill("");
          await page
            .locator(".setup-editor")
            .evaluate((el) => (el.style.zoom = ""));
        }

        assert.equal(
          await page.locator("input:visible, textarea:visible").count(),
          1,
        );
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/ux-essentials-${width}x${height}.png`,
          fullPage: true,
        });
        if (mobile) {
          const trigger = page.getByRole("button", {
            name: "Sections · General",
            exact: true,
          });
          await trigger.click();
          const sheet = page.getByRole("dialog", {
            name: "Setup sections",
            exact: true,
          });
          await sheet.waitFor();
          assert(
            await sheet
              .getByRole("button", { name: "Close sections" })
              .evaluate((el) => el === document.activeElement),
          );
          await sheet
            .getByRole("button", { name: "Electronics", exact: true })
            .focus();
          await page.keyboard.press("Tab");
          assert(
            await sheet
              .getByRole("button", { name: "Close sections" })
              .evaluate((el) => el === document.activeElement),
          );
          await page
            .getByLabel("Title", { exact: true })
            .evaluate((el) => el.focus());
          assert(
            await sheet.evaluate((el) => el.contains(document.activeElement)),
            "modal background must remain inert",
          );
          await page.screenshot({
            path: `artifacts/photo-qa/ux-sheet-${width}x${height}.png`,
          });
          await page.keyboard.press("Escape");
          await sheet.waitFor({ state: "hidden" });
          assert(await trigger.evaluate((el) => el === document.activeElement));
        }
        await page.getByLabel("Title", { exact: true }).fill("UX draft");
        await selectSection("Front");
        await page.waitForFunction(
          () => document.activeElement?.id === "section-front",
        );
        await page
          .getByLabel("Front camber (degrees)", { exact: true })
          .fill("-");
        await selectSection("Wheels & tires");
        await page
          .getByRole("button", {
            name: "Add component: Front hex",
            exact: true,
          })
          .click();
        const draftHex = page.getByLabel("Front hex offset (mm)", {
          exact: true,
        });
        assert(
          !(await draftHex.evaluate((el) => el === document.activeElement)),
          "Add must not automatically open the keyboard",
        );
        await draftHex.fill("1,");
        await selectSection("Rear");
        await selectSection("Wheels & tires");
        assert.equal(await draftHex.inputValue(), "1,");
        await page
          .getByRole("button", { name: "Save setup", exact: true })
          .count()
          .then((n) => assert.equal(n, 0));
        await page
          .getByRole("button", { name: "Create setup", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.activeElement?.getAttribute("name") === "front.camber_deg",
        );
        assert.equal(
          await page
            .getByLabel("Front camber (degrees)", { exact: true })
            .inputValue(),
          "-",
        );
        await assertFocusAboveActions("Front camber (degrees)");
        await page
          .getByLabel("Front camber (degrees)", { exact: true })
          .fill("");
        await selectSection("Wheels & tires");
        await draftHex.fill("Infinity");
        await page
          .getByRole("button", { name: "Done Front hex", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.activeElement?.getAttribute("name") ===
            "runningGear.front.hexOffset",
        );
        await assertFocusAboveActions("Front hex offset (mm)");
        await draftHex.fill("0");
        await page
          .getByRole("button", { name: "Done Front hex", exact: true })
          .click();
        assert.equal(await draftHex.isVisible(), false);
        await page
          .locator('[data-component="front-hex"]')
          .getByText("Offset (mm): 0", { exact: true })
          .waitFor();
        await page.screenshot({
          path: `artifacts/photo-qa/ux-summary-${width}x${height}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Edit Front hex", exact: true })
          .click();
        assert.equal(await draftHex.inputValue(), "0");
        // Resizing changes navigation presentation without recreating the form/editor.
        await page.setViewportSize({
          width: width < 768 ? 1280 : 390,
          height: 900,
        });
        assert.equal(await draftHex.inputValue(), "0");
        await page.setViewportSize({ width, height });
        await page
          .getByRole("button", { name: "Remove Front hex", exact: true })
          .click();
        assert(
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .evaluate((el) => el === document.activeElement),
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(await draftHex.inputValue(), "0");
        await page
          .getByRole("button", { name: "Remove Front hex", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Confirm remove Front hex",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: "Add component: Front hex",
            exact: true,
          })
          .click();
        assert.equal(await draftHex.inputValue(), "");
        await page
          .getByRole("link", { name: "Back to my setups", exact: true })
          .click();
        const discard = page.getByRole("dialog", {
          name: "Leave unsaved changes?",
          exact: true,
        });
        await discard.waitFor();
        assert(
          await discard
            .getByRole("button", { name: "Keep editing", exact: true })
            .evaluate((el) => el === document.activeElement),
        );
        await discard
          .getByRole("button", { name: "Keep editing", exact: true })
          .click();
        assert.equal(
          await page.getByLabel("Title", { exact: true }).inputValue(),
          "UX draft",
        );
        await page
          .getByRole("link", { name: "Back to my setups", exact: true })
          .click();
        await discard
          .getByRole("button", { name: "Discard draft and leave", exact: true })
          .click();
        await page.waitForURL("**/my/setups");
        await page.goto("http://127.0.0.1:5173/my/setups/new");
        console.log(
          `PASS ${width}x${height} UX essentials/disclosure, sheet focus+Escape, hidden error reveal, incomplete drafts, Done, zero summary, resize, confirmed removal/re-add and dirty-exit cancellation`,
        );

        const toolbarCheck = async () => {
          const picker = await formButton({
            name: "Choose photos",
            exact: true,
          });
          const title = await formField("Title", { exact: true });
          await picker.waitFor();
          assert(
            await picker.evaluate((element) =>
              Boolean(
                element.compareDocumentPosition(
                  document.querySelector('[name="title"]'),
                ) & Node.DOCUMENT_POSITION_FOLLOWING,
              ),
            ),
            "photo toolbar must precede setup fields",
          );
          const info = await formButton({
            name: "Photo information",
            exact: true,
          });
          const panel = page.getByRole("region", {
            name: "Photo information details",
          });
          await info.hover();
          await panel.waitFor();
          await geometry();
          await title.click();
          await panel.waitFor({ state: "hidden" });
          await info.focus();
          await panel.waitFor();
          await page.keyboard.press("Escape");
          await panel.waitFor({ state: "hidden" });
          assert(
            await info.evaluate(
              (element) => document.activeElement === element,
            ),
          );
          await info.click();
          await panel.waitFor();
          await panel
            .getByRole("button", { name: "Close photo information" })
            .click();
          await panel.waitFor({ state: "hidden" });
        };
        await toolbarCheck();
        await (
          await formField("Title", { exact: true })
        ).fill("New with photos");
        for (const axle of ["Front", "Rear"]) {
          await (
            await formField(`${axle} hex offset (mm)`, { exact: true })
          ).fill(axle === "Front" ? "0" : "-2,123456789");
          await (
            await formField(`${axle} wheel offset (mm)`, { exact: true })
          ).fill(axle === "Front" ? "-4" : "0");
          for (const part of ["wheel", "tire"]) {
            await (
              await formField(`${axle} ${part} manufacturer`, { exact: true })
            ).selectOption(manufacturerId);
            await (
              await formField(`${axle} ${part} model`, { exact: true })
            ).fill(part === "wheel" ? gearModel : "Tire model");
          }
        }

        await (
          await formField("Front knuckle manufacturer", { exact: true })
        ).selectOption(manufacturerId);
        await (
          await formField("Front knuckle part number / description", {
            exact: true,
          })
        ).fill(knuckleDescription);

        for (const axle of ["Front", "Rear"]) {
          await (
            await formField(`${axle} lower arm mount manufacturer`, {
              exact: true,
            })
          ).selectOption(manufacturerId);
          await (
            await formField(`${axle} lower arm mount model / part number`, {
              exact: true,
            })
          ).fill(mountModel);
          await (
            await formField(`${axle} lower arm mount configuration notes`, {
              exact: true,
            })
          ).fill(mountNotes);
        }

        await (
          await formField("Rear differential type", { exact: true })
        ).selectOption("gear");
        await (
          await formField("Rear differential manufacturer", { exact: true })
        ).selectOption(manufacturerId);
        await (
          await formField("Rear differential model", { exact: true })
        ).fill(differentialModel);
        await (
          await formField("Rear differential tuning notes", { exact: true })
        ).fill(differentialNotes);
        for (const axle of ["Front", "Rear"]) {
          await (
            await formField(`${axle} piston hole count`, { exact: true })
          ).fill("6");
          await (
            await formField(`${axle} piston hole diameter (mm)`, {
              exact: true,
            })
          ).fill("1,23456789");
          await (
            await formField(`${axle} piston notes`, { exact: true })
          ).fill("Two stages\n" + "PistonNotes".repeat(30));
          await (
            await formField(`${axle} seal type`, { exact: true })
          ).selectOption("x-ring");
          await (
            await formField(`${axle} seal description`, { exact: true })
          ).fill("Seal".repeat(45));
        }
        await (
          await formField("Front toe (degrees)", { exact: true })
        ).fill("0");
        await (
          await formField("Rear camber (degrees)", { exact: true })
        ).fill("-1,25");
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/differential-create-${width}x${height}.png`,
          fullPage: true,
        });
        const chooserEvent = page.waitForEvent("filechooser");
        await (
          await formButton({ name: "Choose photos", exact: true })
        ).click();
        const chooser = await chooserEvent;
        assert(chooser.isMultiple());
        assert.equal(creates, 0, "paperclip must not submit setup");
        await chooser.setFiles([
          { name: "first.png", mimeType: "image/png", buffer: placeholder },
          {
            name: "phone.heic",
            mimeType: "image/heic",
            buffer: Buffer.from(
              "opaque HEIC upload; normalized JPEG returned by mock server",
            ),
          },
        ]);
        await (await formButton({ name: "Create setup", exact: true })).click();
        await (
          await formButton({ name: "Retry phone.heic", exact: true })
        ).waitFor();
        assert.equal(creates, 1);
        await page.getByRole("dialog", { name: "Adjust thumbnail" }).waitFor();
        await (await formButton({ name: "Cancel adjustment" })).click();
        fail = false;
        await (
          await formButton({ name: "Retry phone.heic", exact: true })
        ).click();
        await page
          .getByText("Uploaded and saved", { exact: true })
          .nth(1)
          .waitFor();
        assert.equal(creates, 1);
        assert.equal(photos.length, 2);

        await cropDialog.waitFor();
        await cropDialog
          .getByRole("button", { name: "Apply thumbnail" })
          .waitFor();
        await cropDialog.getByLabel("Zoom", { exact: true }).fill("2");
        await cropDialog
          .getByRole("group", { name: "Square thumbnail preview" })
          .focus();
        await page.keyboard.press("ArrowRight");
        await cropDialog
          .getByRole("button", { name: "Apply thumbnail" })
          .click();
        await cropDialog.waitFor({ state: "hidden" });
        assert.equal(cropWrites, 1);
        await geometry();
        await page.goto(`http://127.0.0.1:5173/setups/${id}`);
        for (const axle of ["Front", "Rear"]) {
          const section = page
            .getByRole("heading", { name: `${axle} shocks`, exact: true })
            .locator("..");
          await section.getByText("1.23456789", { exact: true }).waitFor();
          await section.getByText("X-ring", { exact: true }).waitFor();
        }
        for (const axle of ["Front", "Rear"]) {
          const section = page
            .getByRole("heading", {
              name: `${axle} lower arm mount`,
              exact: true,
            })
            .locator("..");
          await section.getByText(manufacturerName, { exact: true }).waitFor();
          await section.getByText(mountModel, { exact: true }).waitFor();
          assert.equal(
            await section
              .getByText(mountNotes, { exact: true })
              .evaluate((el) => getComputedStyle(el).whiteSpace),
            "pre-wrap",
          );
        }
        for (const axle of ["Front", "Rear"]) {
          for (const part of ["wheel", "tire"]) {
            const section = page
              .getByRole("heading", { name: `${axle} ${part}`, exact: true })
              .locator("..");
            await section
              .getByText(manufacturerName, { exact: true })
              .waitFor();
          }
          await page
            .getByRole("heading", { name: `${axle} hex`, exact: true })
            .waitFor();
        }
        const knuckleDetail = page
          .getByRole("heading", { name: "Front steering knuckle", exact: true })
          .locator("..");
        await knuckleDetail
          .getByText(manufacturerName, { exact: true })
          .waitFor();
        await knuckleDetail
          .getByText(knuckleDescription, { exact: true })
          .waitFor();
        const differentialDetail = page
          .getByRole("heading", { name: "Rear differential", exact: true })
          .locator("..");
        await differentialDetail
          .getByText(manufacturerName, { exact: true })
          .waitFor();
        assert.equal(
          await differentialDetail
            .getByText(differentialNotes, { exact: true })
            .evaluate((el) => getComputedStyle(el).whiteSpace),
          "pre-wrap",
        );
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/differential-detail-${width}x${height}.png`,
          fullPage: true,
        });
        await (
          await formButton({ name: "Enlarge photo 1 (cover)", exact: true })
        ).click();
        const viewer = page.getByRole("dialog", {
          name: "Enlarged setup photo",
        });
        await viewer.waitFor();
        const fullImage = viewer.getByAltText("Enlarged setup photo 1");
        await fullImage.waitFor();
        await fullImage.evaluate((image) => image.decode());
        assert(
          await fullImage.evaluate((image) => {
            const box = image.getBoundingClientRect();
            return (
              Math.abs(
                box.width / box.height -
                  image.naturalWidth / image.naturalHeight,
              ) < 0.01 && getComputedStyle(image).objectFit === "contain"
            );
          }),
          "full viewer must keep natural aspect without crop",
        );
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
          await (
            await formButton({ name: "Enlarge photo 1 (cover)" })
          ).evaluate((el) => document.activeElement === el),
        );
        await geometry();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await toolbarCheck();
        await (
          await formField("Title", { exact: true })
        ).fill("Unsaved photo title");
        await (
          await formField("Front knuckle part number / description", {
            exact: true,
          })
        ).fill("Unsaved knuckle part");

        await (
          await formField("Front lower arm mount configuration notes", {
            exact: true,
          })
        ).fill("Unsaved front mount config");
        await (
          await formField("Rear lower arm mount model / part number", {
            exact: true,
          })
        ).fill("Unsaved rear mount");
        await (
          await formField("Front tire model", { exact: true })
        ).fill("Unsaved tire");
        await (
          await formField("Rear hex offset (mm)", { exact: true })
        ).fill("-7,25");

        await (
          await formField("Rear differential tuning notes", { exact: true })
        ).fill("Unsaved differential tuning");
        await (
          await formButton({ name: "Make photo 2 cover", exact: true })
        ).click();
        await (
          await formButton({ name: "Make photo 1 cover", exact: true })
        ).waitFor();
        assert.equal(
          await (await formField("Title", { exact: true })).inputValue(),
          "Unsaved photo title",
        );
        assert.equal(
          await (
            await formField("Front knuckle part number / description", {
              exact: true,
            })
          ).inputValue(),
          "Unsaved knuckle part",
        );

        assert.equal(
          await (
            await formField("Front lower arm mount configuration notes", {
              exact: true,
            })
          ).inputValue(),
          "Unsaved front mount config",
        );
        assert.equal(
          await (
            await formField("Rear lower arm mount model / part number", {
              exact: true,
            })
          ).inputValue(),
          "Unsaved rear mount",
        );

        assert.equal(
          await (
            await formField("Rear differential tuning notes", { exact: true })
          ).inputValue(),
          "Unsaved differential tuning",
        );
        assert.equal(
          await (
            await formField("Front tire model", { exact: true })
          ).inputValue(),
          "Unsaved tire",
        );
        assert.equal(
          await (
            await formField("Rear hex offset (mm)", { exact: true })
          ).inputValue(),
          "-7,25",
        );
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/differential-edit-${width}x${height}.png`,
          fullPage: true,
        });
        for (const destination of ["/", "/my/setups", `/users/${user.id}`]) {
          await page.goto("http://127.0.0.1:5173" + destination);
          await page.getByAltText(`Cover of ${setup.title}`).waitFor();
          const frame = await page
            .getByAltText(`Cover of ${setup.title}`)
            .evaluate((image) => {
              const box = image.parentElement.getBoundingClientRect();
              return { width: box.width, height: box.height };
            });
          assert(
            Math.abs(frame.width - frame.height) < 1,
            "list cover must be square",
          );
          assert(
            frame.width <= (width < 768 ? 88 : 300) + 1,
            "bounded cover size",
          );
          await geometry();
          if (destination === "/my/setups")
            await page.screenshot({
              path: `artifacts/photo-qa/list-${width}x${height}.png`,
              fullPage: true,
            });
        }
        await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
        await (
          await formButton({ name: "Delete photo 2", exact: true })
        ).click();
        await (
          await formButton({ name: "Confirm delete photo 2", exact: true })
        ).click();
        await (
          await formButton({ name: "Delete photo 1", exact: true })
        ).click();
        await (
          await formButton({ name: "Confirm delete photo 1", exact: true })
        ).click();
        await page
          .getByText("0/10 photo slots used (saved and queued).", {
            exact: true,
          })
          .waitFor();
        await page.goto("http://127.0.0.1:5173/my/setups");
        await page.getByAltText("No setup photo — placeholder").waitFor();
        // Visibility does not guarantee decoding has completed on a fresh context.
        await page
          .getByAltText("No setup photo — placeholder")
          .evaluate((img) => img.decode());
        await geometry();
        // Every supported image shape uses server-normalized full JPEGs, never local HEIC decoding.
        photos = shapes.map((_, i) => photo(i + 1));
        setup = {
          ...setup,
          title: "Very long setup title " + "UnbrokenTitle".repeat(14),
          cover_photo: photos[0],
        };
        for (let n = 0; n < shapes.length; n++) {
          await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
          const saved = page.getByAltText(`Saved setup photo ${n + 1}`, {
            exact: true,
          });
          await (
            await formButton({ name: `Adjust thumbnail ${n + 1}`, exact: true })
          ).waitFor();
          await page
            .locator(".photo-grid article")
            .nth(n)
            .locator(".photo-frame")
            .scrollIntoViewIfNeeded();
          await saved.waitFor();
          await saved.evaluate(async (image) => {
            if (!image.complete)
              await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
              });
          });
          const oldSource = await saved.getAttribute("src");
          await (
            await formButton({ name: `Adjust thumbnail ${n + 1}`, exact: true })
          ).click();
          await cropDialog.waitFor();
          const normalized = cropDialog.getByAltText(
            "Normalized photo crop preview",
          );
          await normalized.waitFor();
          await cropDialog.getByLabel("Zoom", { exact: true }).fill("2");
          await geometry();
          // Mouse/pointer pan and touch pointer pan are both dispatched through the actual handlers.
          const preview = cropDialog.getByRole("group", {
            name: "Square thumbnail preview",
          });
          await preview.scrollIntoViewIfNeeded();
          const box = await preview.boundingBox();
          if (width < 768) {
            const touch = await context.newCDPSession(page);
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ x: box.x + 40, y: box.y + 40, id: 1 }],
            });
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x: box.x + 25, y: box.y + 30, id: 1 }],
            });
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
            await touch.detach();
          } else {
            await page.mouse.move(box.x + 60, box.y + 60);
            await page.mouse.down();
            await page.mouse.move(box.x + 40, box.y + 50, { steps: 3 });
            await page.mouse.up();
          }
          await preview.focus();
          await page.keyboard.press("Shift+ArrowRight");
          const draft = {
            x: Number(
              await cropDialog.getByLabel("Horizontal position").inputValue(),
            ),
            y: Number(
              await cropDialog.getByLabel("Vertical position").inputValue(),
            ),
            size: Math.round(
              Math.min(shapes[n].width, shapes[n].height) /
                Number(
                  await cropDialog
                    .getByLabel("Zoom", { exact: true })
                    .inputValue(),
                ),
            ),
          };
          const expectedColors = await normalized.evaluate((image, crop) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 100;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              image,
              crop.x,
              crop.y,
              crop.size,
              crop.size,
              0,
              0,
              100,
              100,
            );
            return [25, 75].flatMap((x) =>
              [25, 75].map((y) =>
                Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3),
              ),
            );
          }, draft);
          await page.screenshot({
            path: `artifacts/photo-qa/crop-${shapes[n].name}-${width}x${height}.png`,
            fullPage: false,
          });
          if (n === 0) {
            const previous = JSON.stringify(photos[n]);
            cropFailure = 503;
            await cropDialog
              .getByRole("button", { name: "Apply thumbnail" })
              .click();
            await cropDialog
              .getByRole("button", { name: "Retry adjustment" })
              .waitFor();
            assert.equal(
              JSON.stringify(photos[n]),
              previous,
              "failed apply must retain saved crop",
            );
            cropFailure = 0;
            await cropDialog
              .getByRole("button", { name: "Retry adjustment" })
              .click();
          } else
            await cropDialog
              .getByRole("button", { name: "Apply thumbnail" })
              .click();
          await cropDialog.waitFor({ state: "hidden" });
          assert.deepEqual(
            photos[n].crop,
            draft,
            "preview coordinate frame must match persisted request",
          );
          await page.waitForFunction(
            ({ alt, old }) => {
              const image = Array.from(document.images).find(
                (i) => i.alt === alt,
              );
              return (
                image?.src !== old && image?.complete && image?.naturalWidth > 0
              );
            },
            { alt: `Saved setup photo ${n + 1}`, old: oldSource },
          );
          assert.notEqual(
            await saved.getAttribute("src"),
            oldSource,
            "same-ID thumbnail blob must refresh after crop",
          );
          if (n !== 5) {
            const colors = await saved.evaluate((image) => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 100;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(image, 0, 0, 100, 100);
              return [25, 75].flatMap((x) =>
                [25, 75].map((y) =>
                  Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3),
                ),
              );
            });
            colors.forEach((sample, i) =>
              sample.forEach((channel, c) =>
                assert(
                  Math.abs(channel - expectedColors[i][c]) <= 64,
                  "preview/thumbnail JPEG color tolerance",
                ),
              ),
            );
          }
          await page.reload();
          await (
            await formButton({ name: `Adjust thumbnail ${n + 1}`, exact: true })
          ).click();
          await cropDialog.waitFor();
          assert.equal(
            Number(
              await cropDialog.getByLabel("Horizontal position").inputValue(),
            ),
            draft.x,
          );
          assert.equal(
            Number(
              await cropDialog.getByLabel("Vertical position").inputValue(),
            ),
            draft.y,
          );
          await page.keyboard.press("Escape");
          await cropDialog.waitFor({ state: "hidden" });
          assert(
            await (
              await formButton({
                name: `Adjust thumbnail ${n + 1}`,
                exact: true,
              })
            ).evaluate((el) => document.activeElement === el),
          );
        }
        // Cover projections need no gallery metadata calls; error and denied states reserve the same square slot.
        setup = { ...setup, cover_photo: photos[1] };
        for (const destination of ["/", "/my/setups", `/users/${user.id}`]) {
          const metadataBefore = metadataReads;
          await page.goto("http://127.0.0.1:5173" + destination);
          const coverImage = page.getByAltText(`Cover of ${setup.title}`);
          await coverImage.waitFor();
          await geometry();
          assert.equal(
            metadataReads,
            metadataBefore,
            "list introduced gallery metadata N+1",
          );
        }
        for (const failure of [500, 404]) {
          mediaFailure = failure;
          await page.reload();
          if (failure === 500)
            await page.getByAltText("Photo could not be displayed").waitFor();
          else
            await page
              .getByText("Photo not found or unavailable.", { exact: true })
              .waitFor();
          await geometry();
        }
        mediaFailure = 0;
        // Owned list view links and separate actions, including long titles and square covers.
        const beforeNavigationWrites = mutationCalls;
        await page.goto("http://127.0.0.1:5173/my/setups");
        const view = page.getByRole("link", {
          name: `View ${setup.title}`,
          exact: true,
        });
        const titleLink = page.getByRole("link", {
          name: setup.title,
          exact: true,
        });
        await view.waitFor();
        assert.equal(await titleLink.getAttribute("href"), `/setups/${id}`);
        assert.equal(await view.getAttribute("href"), `/setups/${id}`);
        const coverBox = await view.boundingBox();
        assert(
          Math.abs(coverBox.width - coverBox.height) < 1,
          "view link must retain square cover slot",
        );
        assert(
          coverBox.width <= (width < 768 ? 89 : 301),
          "cover link grew beyond card bounds",
        );
        await view.focus();
        await page.keyboard.press("Tab");
        assert(await titleLink.evaluate((el) => document.activeElement === el));
        await page.keyboard.press("Tab");
        assert(
          await page
            .getByRole("link", { name: "Edit setup", exact: true })
            .evaluate((el) => document.activeElement === el),
        );
        await page.keyboard.press("Tab");
        assert(
          await (
            await formButton({ name: "Delete setup", exact: true })
          ).evaluate((el) => document.activeElement === el),
        );
        await page.keyboard.press("Enter");
        await (await formButton({ name: "Cancel", exact: true })).click();
        assert.equal(new URL(page.url()).pathname, "/my/setups");
        await titleLink.focus();
        await page.keyboard.press("Enter");
        await page
          .getByRole("heading", { name: setup.title, exact: true })
          .waitFor();
        assert.equal(new URL(page.url()).pathname, `/setups/${id}`);
        assert.equal(
          await (await formField("Title", { exact: true })).count(),
          0,
        );
        assert.equal(
          await (
            await formButton({ name: "Choose photos", exact: true })
          ).count(),
          0,
        );
        await geometry();
        await page.reload();
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .click();
        await (await formField("Title", { exact: true })).waitFor();
        await page
          .getByRole("link", { name: "Back to my setups", exact: true })
          .click();
        await page
          .getByRole("link", { name: `View ${setup.title}`, exact: true })
          .click();
        await page
          .getByRole("heading", { name: setup.title, exact: true })
          .waitFor();
        await geometry();
        // Readable foreign detail and direct foreign edit use the existing ownership guard.
        setup = { ...setup, owner_id: otherOwner };
        await page.reload();
        await page.getByText("Other owner", { exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole("link", { name: "Edit setup", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await (
            await formButton({ name: "Choose photos", exact: true })
          ).count(),
          0,
        );
        await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
        await page
          .getByText("Setup not found or unavailable.", { exact: true })
          .waitFor();
        assert.equal(
          await (await formField("Title", { exact: true })).count(),
          0,
        );
        assert.equal(
          await (
            await formButton({ name: "Choose photos", exact: true })
          ).count(),
          0,
        );
        assert.equal(
          mutationCalls,
          beforeNavigationWrites,
          "view/edit navigation sent mutations",
        );
        await geometry();
        // Differential-specific edit validation and historical catalog behavior at every viewport.
        // The preceding read-only layout fixture deliberately has a title above the write limit.
        // Start this independent validation scenario with a valid title so model is first invalid.
        setup = {
          ...setup,
          owner_id: user.id,
          title: "Differential browser setup",
        };
        manufacturerActive = false;
        await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
        await (
          await formField("Rear differential model", { exact: true })
        ).waitFor();
        assert.equal(
          await (
            await formField("Rear differential model", { exact: true })
          ).inputValue(),
          differentialModel,
        );
        await (
          await formButton({
            name: "Change differential manufacturer",
            exact: true,
          })
        ).click();
        await page
          .getByText("No active manufacturers available.", { exact: true })
          .waitFor();
        assert.equal(
          await (
            await formField("Rear differential manufacturer", { exact: true })
          ).inputValue(),
          manufacturerId,
        );
        await (
          await formButton({ name: "Cancel manufacturer change", exact: true })
        ).click();
        const beforeInvalid = mutationCalls;
        await (
          await formField("Rear differential model", { exact: true })
        ).fill("x".repeat(201));
        await (await formButton({ name: "Save setup", exact: true })).click();
        await page
          .getByText("Use at most 200 characters.", { exact: true })
          .waitFor();
        assert.equal(mutationCalls, beforeInvalid);
        assert(
          await (
            await formField("Rear differential model", { exact: true })
          ).evaluate((el) => el === document.activeElement),
        );
        const expectedOtherData = structuredClone(setup.data);
        delete expectedOtherData.rear_differential;
        await (
          await formButton({ name: "Clear rear differential", exact: true })
        ).click();
        await (
          await formField("Rear differential tuning notes", { exact: true })
        ).fill("Spring only\nNo type required");
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data, {
          ...expectedOtherData,
          rear_differential: { tuning_notes: "Spring only\nNo type required" },
        });
        await (
          await formButton({ name: "Clear rear differential", exact: true })
        ).click();
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data, expectedOtherData);
        const typeSelect = await formField("Rear differential type", {
          exact: true,
        });
        await typeSelect.focus();
        // Native typeahead selects Spool without Enter submitting the form on macOS.
        await page.keyboard.press("s");
        await page.keyboard.press("Tab");
        assert.equal(await typeSelect.inputValue(), "spool");
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data.rear_differential, { type: "spool" });
        for (const axle of ["Front", "Rear"]) {
          assert.equal(
            await (
              await formField(`${axle} piston hole count`, { exact: true })
            ).inputValue(),
            "6",
          );
        }
        const beforeHardware = JSON.parse(JSON.stringify(setup.data));
        const writesBeforeHardware = setupPatches;
        await (
          await formField("Front piston hole count", { exact: true })
        ).fill("1.5");
        await (await formButton({ name: "Save setup", exact: true })).click();
        assert.equal(
          await (
            await formField("Front piston hole count", { exact: true })
          ).getAttribute("aria-invalid"),
          "true",
        );
        assert(
          await (
            await formField("Front piston hole count", { exact: true })
          ).evaluate((el) => document.activeElement === el),
        );
        assert.equal(setupPatches, writesBeforeHardware);
        for (const axle of ["front", "rear"]) {
          await (
            await formButton({ name: `Clear ${axle} piston`, exact: true })
          ).click();
          await (
            await formButton({ name: `Clear ${axle} seal`, exact: true })
          ).click();
          delete beforeHardware.shocks[axle].piston;
          delete beforeHardware.shocks[axle].seal;
          if (!Object.keys(beforeHardware.shocks[axle]).length)
            delete beforeHardware.shocks[axle];
        }
        if (!Object.keys(beforeHardware.shocks).length)
          delete beforeHardware.shocks;
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data, beforeHardware);
        await (
          await formField("Front piston notes", { exact: true })
        ).fill("Notes only\nNo count");
        await (
          await formField("Rear seal description", { exact: true })
        ).fill("Product only");
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data.shocks.front.piston, {
          notes: "Notes only\nNo count",
        });
        assert.deepEqual(setup.data.shocks.rear.seal, {
          description: "Product only",
        });
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/shock-hardware-${width}x${height}.png`,
          fullPage: true,
        });

        for (const axle of ["Front", "Rear"]) {
          const side = axle.toLowerCase();
          const group = await formGroup({
            name: `${axle} lower arm mount`,
            exact: true,
          });
          const expected = JSON.parse(JSON.stringify(setup.data));
          const writes = setupPatches;
          await (
            await formField(`${axle} lower arm mount model / part number`, {
              exact: true,
            })
          ).fill("x".repeat(201));
          await (await formButton({ name: "Save setup", exact: true })).click();
          assert.equal(setupPatches, writes);
          assert(
            await (
              await formField(`${axle} lower arm mount model / part number`, {
                exact: true,
              })
            ).evaluate((el) => document.activeElement === el),
          );
          assert.equal(
            await (
              await formField(`${axle} lower arm mount model / part number`, {
                exact: true,
              })
            ).getAttribute("aria-invalid"),
            "true",
          );
          await (
            await formButton({
              name: `Clear ${side} lower arm mount`,
              exact: true,
            })
          ).click();
          await (
            await formButton({
              name: `Change ${side} lower arm mount manufacturer`,
              exact: true,
            })
          ).click();
          await (
            await formField(`${axle} lower arm mount manufacturer`, {
              exact: true,
            })
          ).selectOption(manufacturerId);
          await group
            .getByRole("button", {
              name: "Cancel manufacturer change",
              exact: true,
            })
            .click();
          await group
            .getByText(`${axle} lower arm mount manufacturer: Not specified`, {
              exact: true,
            })
            .waitFor();
          await (await formButton({ name: "Save setup", exact: true })).click();
          await savedAndReopen();
          delete expected.suspension[side].lower_arm_mount;
          if (!Object.keys(expected.suspension[side]).length)
            delete expected.suspension[side];
          if (!Object.keys(expected.suspension).length)
            delete expected.suspension;
          assert.deepEqual(setup.data, expected);
          await (
            await formField(`${axle} lower arm mount configuration notes`, {
              exact: true,
            })
          ).fill("Notes only\nNo model required");
          await (await formButton({ name: "Save setup", exact: true })).click();
          await savedAndReopen();
          assert.deepEqual(setup.data.suspension[side].lower_arm_mount, {
            configuration_notes: "Notes only\nNo model required",
          });
          await geometry();
        }
        await page.screenshot({
          path: `artifacts/photo-qa/lower-arm-mounts-${width}x${height}.png`,
          fullPage: true,
        });
        console.log(
          `PASS ${width}x${height} lower arm mounts on both axles, create/detail/edit, shared catalog/historical names, Unicode/wrapping, validation/focus, clear/cancel/partial re-add and full-data/photo preservation`,
        );
        for (const axle of ["Front", "Rear"]) {
          const side = axle.toLowerCase();
          const before = JSON.parse(JSON.stringify(setup.data));
          const writes = setupPatches;
          const offset = await formField(`${axle} wheel offset (mm)`, {
            exact: true,
          });
          await offset.fill("1.5");
          await (await formButton({ name: "Save setup", exact: true })).click();
          assert.equal(setupPatches, writes);
          assert.equal(await offset.getAttribute("aria-invalid"), "true");
          assert(await offset.evaluate((el) => el === document.activeElement));
          await offset.fill("-2147483648");
          await (
            await formField(`${axle} hex offset (mm)`, { exact: true })
          ).fill("-3,123456789");
          await (await formButton({ name: "Save setup", exact: true })).click();
          await savedAndReopen();
          assert.equal(
            setup.data.running_gear[side].wheel.offset_mm,
            -2147483648,
          );
          assert.equal(
            setup.data.running_gear[side].hex.offset_mm,
            -3.123456789,
          );
          for (const part of ["hex", "wheel", "tire"]) {
            await (
              await formButton({ name: `Clear ${side} ${part}`, exact: true })
            ).click();
          }
          const wheelGroup = await formGroup({
            name: `${axle} wheel`,
            exact: true,
          });
          await (
            await formButton({
              name: `Change ${side} wheel manufacturer`,
              exact: true,
            })
          ).click();
          await wheelGroup
            .getByLabel(`${axle} wheel manufacturer`, { exact: true })
            .selectOption(manufacturerId);
          await wheelGroup
            .getByRole("button", {
              name: "Cancel manufacturer change",
              exact: true,
            })
            .click();
          await wheelGroup
            .getByText(`${axle} wheel manufacturer: Not specified`, {
              exact: true,
            })
            .waitFor();
          await (await formButton({ name: "Save setup", exact: true })).click();
          await savedAndReopen();
          delete before.running_gear[side];
          if (!Object.keys(before.running_gear).length)
            delete before.running_gear;
          assert.deepEqual(setup.data, before);
          await (
            await formField(`${axle} tire model`, { exact: true })
          ).fill("Model only");
          await (
            await formField(`${axle} wheel offset (mm)`, { exact: true })
          ).fill("0");
          await (await formButton({ name: "Save setup", exact: true })).click();
          await savedAndReopen();
          assert.deepEqual(setup.data.running_gear[side], {
            wheel: { offset_mm: 0 },
            tire: { model: "Model only" },
          });
        }
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/running-gear-${width}x${height}.png`,
          fullPage: true,
        });
        console.log(
          `PASS ${width}x${height} running gear create/edit/detail, independent signed/zero offsets, historical catalogue, Unicode, validation/focus, clear/cancel/re-add and full-data preservation`,
        );
        const knuckleGroup = await formGroup({
          name: "Front steering knuckle",
          exact: true,
        });
        const preservedBeforeKnuckle = JSON.parse(JSON.stringify(setup.data));
        const patchesBeforeKnuckle = setupPatches;
        await (
          await formField("Front knuckle part number / description", {
            exact: true,
          })
        ).fill("x".repeat(201));
        await (await formButton({ name: "Save setup", exact: true })).click();
        assert.equal(setupPatches, patchesBeforeKnuckle);
        assert(
          await (
            await formField("Front knuckle part number / description", {
              exact: true,
            })
          ).evaluate((el) => document.activeElement === el),
        );
        assert.equal(
          await (
            await formField("Front knuckle part number / description", {
              exact: true,
            })
          ).getAttribute("aria-invalid"),
          "true",
        );
        await (
          await formButton({ name: "Clear front knuckle", exact: true })
        ).click();
        await (
          await formButton({ name: "Change knuckle manufacturer", exact: true })
        ).click();
        await (
          await formField("Front knuckle manufacturer", { exact: true })
        ).selectOption(manufacturerId);
        await knuckleGroup
          .getByRole("button", {
            name: "Cancel manufacturer change",
            exact: true,
          })
          .click();
        await knuckleGroup
          .getByText("Front knuckle manufacturer: Not specified", {
            exact: true,
          })
          .waitFor();
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        delete preservedBeforeKnuckle.front_steering_knuckle;
        assert.deepEqual(setup.data, preservedBeforeKnuckle);
        await (
          await formField("Front knuckle part number / description", {
            exact: true,
          })
        ).fill("Part only\nNo manufacturer required");
        await (await formButton({ name: "Save setup", exact: true })).click();
        await savedAndReopen();
        assert.deepEqual(setup.data.front_steering_knuckle, {
          description: "Part only\nNo manufacturer required",
        });
        await geometry();
        await page.screenshot({
          path: `artifacts/photo-qa/knuckle-${width}x${height}.png`,
          fullPage: true,
        });
        console.log(
          `PASS ${width}x${height} knuckle create/edit/detail, shared catalog, historical display, Unicode/wrapping, validation/focus, clear/cancel/re-add, photo and full-data preservation`,
        );
        console.log(
          `PASS ${width}x${height} shock piston/seal both axles, decimal precision, optional clear/re-add, validation/focus and full-data preservation`,
        );

        await geometry();
        console.log(
          `PASS ${width}x${height} differential create/detail/edit, multiline/wrapping, historical catalog, validation/focus, optional notes-only/clear/re-add, keyboard, numeric/full-data and unsaved-photo preservation`,
        );
        console.log(
          `PASS ${width}x${height} owned placeholder/cover/title navigation, keyboard order, separate Delete cancellation, read-only detail/reload/Edit, foreign detail/edit, no mutations`,
        );
        console.log(
          `PASS ${width}x${height} placeholder/create once/partial retry/crop shapes/pointer+touch+keyboard/preview match/revision refresh/reload/failure retry/gallery focus/unsaved fields/square lists/no N+1/cover-delete/no overflow; mocked HTTP, emulated Chromium`,
        );
      } else {
        await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
        // Issue #34: General is the initial edit view; the navigator precedes all fields.
        await page.getByLabel("Title", { exact: true }).waitFor();
        assert.equal(
          await page
            .locator('.section-sidebar button[aria-current="location"]')
            .innerText(),
          "General",
        );
        const placement = await page.evaluate(() => {
          const nav = document.querySelector(".sections-trigger");
          const photos = document.querySelector(".general-photos");
          const title = document.querySelector('[name="title"]');
          const notes = document.querySelector('[name="notes"]');
          const visibility = document.querySelector('[name="visibility"]');
          const follows = (a, b) =>
            !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
          return (
            follows(nav, photos) &&
            follows(photos, title) &&
            follows(title, notes) &&
            follows(notes, visibility)
          );
        });
        assert(
          placement,
          "General photos/title/chassis/notes/visibility must follow navigation in order",
        );
        for (const name of [
          "General",
          "Front",
          "Rear",
          "Shocks",
          "Wheels & tires",
          "Electronics",
        ]) {
          await selectSection(name);
          assert.equal(
            await page
              .getByRole("button", { name: /clear current section/i })
              .count(),
            0,
          );
          assert.equal(await page.locator(".section-clear").count(), 0);
          if (name === "Front") {
            await page.evaluate(() => window.scrollTo(0, 0));
            await geometry();
            await page.screenshot({
              path: `artifacts/photo-qa/correction-front-${width}x${height}.png`,
              fullPage: true,
            });
            const add = page.getByRole("button", {
              name: "Add component",
              exact: true,
            });
            if (await add.isEnabled()) {
              await add.click();
              const panel = page.getByRole("group", {
                name: "Available components",
                exact: true,
              });
              await panel.waitFor({ state: "visible" });
              const addBox = await add.boundingBox();
              const addArrow = await add
                .locator("svg.disclosure-chevron")
                .boundingBox();
              assert(
                addBox &&
                  addArrow &&
                  Math.abs(
                    addArrow.y +
                      addArrow.height / 2 -
                      (addBox.y + addBox.height / 2),
                  ) < 2,
                "Add component chevron must be vertically centered",
              );
              assert.equal(
                await panel.getByRole("button", { name: /close/i }).count(),
                0,
              );
              await page.screenshot({
                path: `artifacts/photo-qa/correction-front-choices-${width}x${height}.png`,
              });
              await add.click();
              await panel.waitFor({ state: "hidden" });
            }
          }
        }
        await selectSection("General");
        const visibilityStyle = await page
          .getByLabel("Visibility", { exact: true })
          .evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              appearance: style.appearance,
              position: style.backgroundPosition,
              image: style.backgroundImage,
            };
          });
        assert.equal(visibilityStyle.appearance, "none");
        assert(
          visibilityStyle.image.includes("svg") &&
            visibilityStyle.position.includes("50%"),
          "native select indicator must be centered",
        );
        await page.emulateMedia({ forcedColors: "active" });
        assert.equal(
          await page
            .getByLabel("Visibility", { exact: true })
            .evaluate((el) => getComputedStyle(el).appearance),
          "auto",
          "forced colors must retain the native indicator",
        );
        await page.emulateMedia({ forcedColors: "none" });
        await page
          .getByLabel("Notes", { exact: true })
          .fill("General draft retained");
        const queuedInput = page.getByLabel("Photo files", { exact: true });
        await queuedInput.setInputFiles({
          name: "section-draft.heic",
          mimeType: "image/heic",
          buffer: Buffer.from("original queued bytes"),
        });
        await page.getByText("section-draft.heic", { exact: true }).waitFor();
        await selectSection("Front");
        assert.equal(
          await page
            .getByText("section-draft.heic", { exact: true })
            .isVisible(),
          false,
        );
        await selectSection("General");
        await page.getByText("section-draft.heic", { exact: true }).waitFor();
        await page
          .getByRole("button", {
            name: "Remove queued section-draft.heic",
            exact: true,
          })
          .click();
        assert.equal(
          await page.getByLabel("Notes", { exact: true }).inputValue(),
          "General draft retained",
        );

        // An immediate photo upload must keep running when General is hidden. Its
        // automatic crop offer must remain usable and must not discard technical state.
        await queuedInput.setInputFiles({
          name: "continued-upload.heic",
          mimeType: "image/heic",
          buffer: Buffer.from("original unchanged HEIF selection"),
        });
        let releaseUpload;
        uploadGate = new Promise((resolve) => {
          releaseUpload = resolve;
        });
        const uploadRequest = page.waitForRequest(
          (request) =>
            request.method() === "POST" &&
            new URL(request.url()).pathname === `/api/v1/setups/${id}/photos`,
        );
        await page
          .getByRole("button", { name: "Upload queued photos", exact: true })
          .click();
        await uploadRequest;
        try {
          await selectSection("Front");
        } finally {
          releaseUpload();
          uploadGate = null;
        }
        await cropDialog.waitFor({ state: "visible" });
        await cropDialog
          .getByRole("button", { name: "Cancel adjustment", exact: true })
          .click();
        await cropDialog.waitFor({ state: "hidden" });
        assert(
          await page.evaluate(
            () =>
              document.activeElement !== document.body &&
              !document.activeElement?.closest("[hidden]"),
          ),
          "crop dismissal restores visible section focus",
        );
        await selectSection("General");
        assert.equal(
          await page.getByLabel("Notes", { exact: true }).inputValue(),
          "General draft retained",
        );
        await geometry();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `artifacts/photo-qa/compact-general-${width}x${height}.png`,
          fullPage: true,
        });
        if (width === 1280) {
          await page
            .locator(".setup-editor")
            .evaluate((el) => (el.style.zoom = "2"));
          await geometry();
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: "artifacts/photo-qa/compact-edit-200-percent-form-zoom.png",
            fullPage: true,
          });
          await page
            .locator(".setup-editor")
            .evaluate((el) => (el.style.zoom = ""));
        }
        // Retain all prior follow-up checks, with the approved compact controls.
        assert.equal(
          await page
            .getByRole("button", { name: "Delete setup", exact: true })
            .count(),
          1,
        );
        await selectSection("Wheels & tires");
        assert.equal(
          await page
            .getByRole("button", { name: "Delete setup", exact: true })
            .count(),
          0,
        );
        await selectSection("Wheels & tires");
        assert.equal(
          await page
            .getByRole("button", { name: "Add component", exact: true })
            .count(),
          1,
        );
        await page
          .getByRole("button", { name: "Add component", exact: true })
          .click();
        const choices = page.getByRole("group", {
          name: "Available components",
          exact: true,
        });
        await choices.waitFor({ state: "visible" });
        await page.screenshot({
          path: `artifacts/photo-qa/compact-add-choices-${width}x${height}.png`,
        });
        assert.equal(
          await choices
            .getByRole("button", { name: "Front wheel", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await choices
            .getByRole("button", { name: "Rear differential", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await choices.getByRole("button", { name: /close/i }).count(),
          0,
        );
        assert.deepEqual(await choices.getByRole("button").allTextContents(), [
          "Front hex",
          "Rear hex",
        ]);
        const disclosure = page.getByRole("button", {
          name: "Add component",
          exact: true,
        });
        assert.equal(await disclosure.getAttribute("aria-expanded"), "true");
        const panelId = await disclosure.getAttribute("aria-controls");
        assert.equal(await choices.getAttribute("id"), panelId);
        await disclosure.click();
        await choices.waitFor({ state: "hidden" });
        assert.equal(await disclosure.getAttribute("aria-expanded"), "false");
        await disclosure.focus();
        await page.keyboard.press("Enter");
        await choices.waitFor({ state: "visible" });
        await page.keyboard.press(" ");
        await choices.waitFor({ state: "hidden" });
        await disclosure.click();
        await choices.waitFor({ state: "visible" });
        await choices
          .getByRole("button", { name: "Front hex", exact: true })
          .focus();
        await page.keyboard.press("Escape");
        await choices.waitFor({ state: "hidden" });
        assert(
          await disclosure.evaluate((el) => el === document.activeElement),
        );
        // Exercise actual touch events on phone/landscape contexts, plus mouse on desktop.
        if (mobile) {
          await disclosure.tap();
          await choices.waitFor({ state: "visible" });
          await disclosure.tap();
          await choices.waitFor({ state: "hidden" });
        }
        // Selecting an actual choice opens exactly that editor and closes disclosure.
        if (mobile) await disclosure.tap();
        else await disclosure.click();
        const chosenComponent = choices.getByRole("button", {
          name: "Front hex",
          exact: true,
        });
        if (mobile) await chosenComponent.tap();
        else await chosenComponent.click();
        await page
          .getByLabel("Front hex offset (mm)", { exact: true })
          .waitFor({ state: "visible" });
        await choices.waitFor({ state: "hidden" });
        await page
          .getByRole("button", { name: "Close Front hex editor", exact: true })
          .click();
        await page
          .getByLabel("Front hex offset (mm)", { exact: true })
          .waitFor({ state: "hidden" });
        await disclosure.click();
        await choices.waitFor({ state: "visible" });
        assert.deepEqual(await choices.getByRole("button").allTextContents(), [
          "Rear hex",
        ]);
        await disclosure.click();
        await choices.waitFor({ state: "hidden" });

        const wholeCard = page.getByRole("button", {
          name: "Edit Front wheel",
          exact: true,
        });
        await wholeCard.focus();
        await page.keyboard.press("Enter");
        await page
          .getByLabel("Front wheel model", { exact: true })
          .fill("Uncommitted draft");
        await page.screenshot({
          path: `artifacts/photo-qa/compact-inline-editor-${width}x${height}.png`,
        });
        await page
          .getByRole("button", {
            name: "Close Front wheel editor",
            exact: true,
          })
          .click();
        await page
          .getByLabel("Front wheel model", { exact: true })
          .waitFor({ state: "hidden" });
        assert.equal(
          await page
            .getByLabel("Front wheel model", { exact: true })
            .isVisible(),
          false,
        );
        await page
          .getByRole("button", { name: "Remove Front wheel", exact: true })
          .click();
        assert.equal(await wholeCard.getAttribute("aria-expanded"), "false");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await wholeCard.click();
        assert.equal(
          await page
            .getByLabel("Front wheel model", { exact: true })
            .inputValue(),
          "Uncommitted draft",
        );
        await (
          await formField("Front wheel model", { exact: true })
        ).fill("界".repeat(200));
        await (
          await formField("Front wheel offset (mm)", { exact: true })
        ).fill("0");
        await page
          .getByRole("button", { name: "Done Front wheel", exact: true })
          .click();
        const preview = page.locator(
          '[data-component="front-wheel"] .component-summary-rows',
        );
        await preview.waitFor({ state: "visible" });
        assert.equal(await preview.locator("dt").count(), 2);
        assert.equal(await preview.locator("dd").last().innerText(), "0");
        assert.equal(
          await preview.locator("dd").first().textContent(),
          "界".repeat(200),
        );
        const rows = await preview.locator(":scope > div").evaluateAll((els) =>
          els.map((el) => ({
            top: el.getBoundingClientRect().top,
            bottom: el.getBoundingClientRect().bottom,
          })),
        );
        assert(
          rows[1].top >= rows[0].bottom,
          "preview fields must occupy separate vertical rows",
        );
        await geometry();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `artifacts/photo-qa/compact-summary-rows-${width}x${height}.png`,
          fullPage: true,
        });
        // Expand a long editor, then scroll within the same section. The compact
        // picker must stay above content and the focused field must stay reachable.
        await (
          await formField("Rear tire model", { exact: true })
        ).fill("Partial tire");
        if (mobile) {
          // Reduced visual space approximates an open keyboard, not native iOS keyboard behavior.
          await page.setViewportSize({ width, height: Math.min(height, 460) });
          await page.getByLabel("Rear tire model", { exact: true }).click();
          await assertFocusAboveActions("Rear tire model");
          await page.screenshot({
            path: `artifacts/photo-qa/compact-focused-short-${width}x${height}.png`,
          });
          await page.setViewportSize({ width, height });
          await page
            .getByLabel("Rear tire model", { exact: true })
            .scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollBy(0, 150));
          const strip = page.locator(".sections-trigger-sticky");
          const box = await strip.boundingBox();
          assert(
            box &&
              box.y >= 11 &&
              box.y < 16 &&
              box.height >= 64 &&
              box.height < 90,
            "distinct section picker must retain breathing room below the safe top edge",
          );
          assert.equal(await strip.locator("svg.section-chevron").count(), 1);
          assert.equal(
            await strip.getByText("Section", { exact: true }).count(),
            1,
          );
          const arrow = await strip
            .locator("svg.section-chevron")
            .boundingBox();
          assert(
            arrow &&
              Math.abs(arrow.y + arrow.height / 2 - (box.y + box.height / 2)) <
                2,
            "section chevron must be vertically centered",
          );
          assert.equal(
            await strip.evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(224, 242, 254)",
          );
          await page.screenshot({
            path: `artifacts/photo-qa/compact-sticky-${width}x${height}.png`,
          });
          await strip.click();
          const sheet = page.getByRole("dialog", {
            name: "Setup sections",
            exact: true,
          });
          await sheet
            .getByRole("button", { name: "Electronics", exact: true })
            .focus();
          await page.keyboard.press("Tab");
          assert(
            await sheet
              .getByRole("button", { name: "Close sections" })
              .evaluate((el) => el === document.activeElement),
          );
          await page.keyboard.press("Escape");
          await sheet.waitFor({ state: "hidden" });
          assert(await strip.evaluate((el) => el === document.activeElement));
        }
        const beforeCorrectionSave = structuredClone(setup.data);
        await (
          await formField("Front wheel offset (mm)", { exact: true })
        ).fill("Infinity");
        const failedPatches = setupPatches;
        await page
          .getByRole("button", { name: "Save setup", exact: true })
          .click();
        assert(new URL(page.url()).pathname.endsWith("/edit"));
        assert.equal(setupPatches, failedPatches);
        await assertFocusAboveActions("Front wheel offset (mm)");
        await (
          await formField("Front wheel offset (mm)", { exact: true })
        ).fill("0");
        assert.equal(
          await page
            .getByRole("button", { name: /clear current section/i })
            .count(),
          0,
        );
        // Save has real route replacement; do not reopen through the helper here.
        await page
          .getByRole("button", { name: "Save setup", exact: true })
          .click();
        await page.waitForURL(`**/setups/${id}`);
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .waitFor();
        await page
          .getByLabel("Title", { exact: true })
          .waitFor({ state: "detached" });
        assert.equal(
          await page.getByLabel("Title", { exact: true }).count(),
          0,
        );
        const expectedData = structuredClone(beforeCorrectionSave);
        expectedData.running_gear.front.wheel = {
          model: "界".repeat(200),
          offset_mm: 0,
        };
        expectedData.running_gear.rear.tire = { model: "Partial tire" };
        assert.deepEqual(
          setup.data,
          expectedData,
          "disclosure and navigation preserve full data apart from explicit field edits",
        );
        await page.goBack();
        assert(
          !new URL(page.url()).pathname.endsWith("/edit"),
          "Back must not return to the replaced section editor",
        );
        await geometry();
        console.log(
          `PASS ${width}x${height} Edit Sections vertical long/zero/partial previews, deletion hierarchy, sticky chevron/sheet focus, no bulk-clear controls, single-trigger disclosure/keyboard, validation/no-exit, successful replace/detail/Back`,
        );
      }
    } finally {
      // Let the app finish issuing media reads before draining interception. A
      // newly dispatched route must not race context shutdown and be handled twice.
      await page.waitForLoadState("networkidle");
      // Cancelled image requests can stop counting as network activity while their
      // mock thumbnail renderer is still running. Finish those callbacks first.
      while (pendingRoutes.size) await Promise.all([...pendingRoutes]);
      await page.unrouteAll({ behavior: "wait" });
      await context.close();
    }
  };
  const failures = [];
  for (const [width, height] of [
    [320, 900],
    [375, 900],
    [390, 900],
    [768, 900],
    [1280, 900],
    [640, 360],
  ]) {
    for (const scenario of scenarios) {
      console.log(`RUN ${scenario} ${width}x${height}`);
      try {
        await runScenario(scenario, width, height);
      } catch (error) {
        console.error(`FAIL ${scenario} ${width}x${height}`, error);
        failures.push(
          new Error(`${scenario} ${width}x${height}`, { cause: error }),
        );
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Browser scenarios failed");
} finally {
  await browser?.close();
  server.kill();
}
