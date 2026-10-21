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
    const manufacturerId = "33333333-3333-4333-8333-333333333333";
    const manufacturerName =
      "Historical differential manufacturer " + "long-name-".repeat(10);
    const differentialModel = "Diff-".repeat(35);
    const differentialNotes = "Oil 10000\nTwo gears " + "tuning-".repeat(45);
    let manufacturerActive = true;
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
      rear_differential_manufacturer: null,
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
              owner: { id: user.id, nickname: user.nickname, avatar_url: null },
            },
          ],
          next_cursor: null,
        };
      else if (path === "/api/v1/setups" && req.method() === "POST") {
        creates++;
        setup = {
          ...setup,
          ...req.postDataJSON(),
          rear_differential_manufacturer: {
            id: manufacturerId,
            name: manufacturerName,
          },
        };
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
          const update = req.postDataJSON();
          setup = {
            ...setup,
            ...update,
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
    const placeholderLink = page.getByRole("link", {
      name: `View ${setup.title}`,
      exact: true,
    });
    assert.equal(await placeholderLink.getAttribute("href"), `/setups/${id}`);
    await placeholderLink.click();
    await page
      .getByRole("heading", { name: setup.title, exact: true })
      .waitFor();
    assert.equal(await page.getByLabel("Title", { exact: true }).count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Choose photos", exact: true })
        .count(),
      0,
    );
    await page.getByRole("link", { name: "Edit setup", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Title", { exact: true }).inputValue(),
      setup.title,
    );
    assert.equal(mutationCalls, 0);
    await page.goto("http://127.0.0.1:5173/my/setups/new");
    const toolbarCheck = async () => {
      const picker = page.getByRole("button", {
        name: "Choose photos",
        exact: true,
      });
      const title = page.getByLabel("Title", { exact: true });
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
      const info = page.getByRole("button", {
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
        await info.evaluate((element) => document.activeElement === element),
      );
      await info.click();
      await panel.waitFor();
      await panel
        .getByRole("button", { name: "Close photo information" })
        .click();
      await panel.waitFor({ state: "hidden" });
    };
    await toolbarCheck();
    await page.getByLabel("Title", { exact: true }).fill("New with photos");
    await page
      .getByLabel("Rear differential type", { exact: true })
      .selectOption("gear");
    await page
      .getByLabel("Rear differential manufacturer", { exact: true })
      .selectOption(manufacturerId);
    await page
      .getByLabel("Rear differential model", { exact: true })
      .fill(differentialModel);
    await page
      .getByLabel("Rear differential tuning notes", { exact: true })
      .fill(differentialNotes);
    await page.getByLabel("Front toe (degrees)", { exact: true }).fill("0");
    await page
      .getByLabel("Rear camber (degrees)", { exact: true })
      .fill("-1,25");
    await geometry();
    await page.screenshot({
      path: `artifacts/photo-qa/differential-create-${width}x${height}.png`,
      fullPage: true,
    });
    const chooserEvent = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Choose photos", exact: true })
      .click();
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
    await page
      .getByRole("button", { name: "Create setup", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retry phone.heic", exact: true })
      .waitFor();
    assert.equal(creates, 1);
    await page.getByRole("dialog", { name: "Adjust thumbnail" }).waitFor();
    await page.getByRole("button", { name: "Cancel adjustment" }).click();
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
    const cropDialog = page.getByRole("dialog", { name: "Adjust thumbnail" });
    await cropDialog.waitFor();
    await cropDialog.getByRole("button", { name: "Apply thumbnail" }).waitFor();
    await cropDialog.getByLabel("Zoom", { exact: true }).fill("2");
    await cropDialog
      .getByRole("group", { name: "Square thumbnail preview" })
      .focus();
    await page.keyboard.press("ArrowRight");
    await cropDialog.getByRole("button", { name: "Apply thumbnail" }).click();
    await cropDialog.waitFor({ state: "hidden" });
    assert.equal(cropWrites, 1);
    await geometry();
    await page.goto(`http://127.0.0.1:5173/setups/${id}`);
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
    await page
      .getByRole("button", { name: "Enlarge photo 1 (cover)", exact: true })
      .click();
    const viewer = page.getByRole("dialog", { name: "Enlarged setup photo" });
    await viewer.waitFor();
    const fullImage = viewer.getByAltText("Enlarged setup photo 1");
    await fullImage.waitFor();
    await fullImage.evaluate((image) => image.decode());
    assert(
      await fullImage.evaluate((image) => {
        const box = image.getBoundingClientRect();
        return (
          Math.abs(
            box.width / box.height - image.naturalWidth / image.naturalHeight,
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
      await page
        .getByRole("button", { name: "Enlarge photo 1 (cover)" })
        .evaluate((el) => document.activeElement === el),
    );
    await geometry();
    await page.getByRole("link", { name: "Edit setup", exact: true }).click();
    await toolbarCheck();
    await page.getByLabel("Title", { exact: true }).fill("Unsaved photo title");
    await page
      .getByLabel("Rear differential tuning notes", { exact: true })
      .fill("Unsaved differential tuning");
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
    assert.equal(
      await page
        .getByLabel("Rear differential tuning notes", { exact: true })
        .inputValue(),
      "Unsaved differential tuning",
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
      assert(frame.width <= (width < 768 ? 88 : 300) + 1, "bounded cover size");
      await geometry();
      if (destination === "/my/setups")
        await page.screenshot({
          path: `artifacts/photo-qa/list-${width}x${height}.png`,
          fullPage: true,
        });
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
      await page
        .getByRole("button", { name: `Adjust thumbnail ${n + 1}`, exact: true })
        .waitFor();
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
      await page
        .getByRole("button", { name: `Adjust thumbnail ${n + 1}`, exact: true })
        .click();
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
              await cropDialog.getByLabel("Zoom", { exact: true }).inputValue(),
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
          const image = Array.from(document.images).find((i) => i.alt === alt);
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
      await page
        .getByRole("button", { name: `Adjust thumbnail ${n + 1}`, exact: true })
        .click();
      await cropDialog.waitFor();
      assert.equal(
        Number(await cropDialog.getByLabel("Horizontal position").inputValue()),
        draft.x,
      );
      assert.equal(
        Number(await cropDialog.getByLabel("Vertical position").inputValue()),
        draft.y,
      );
      await page.keyboard.press("Escape");
      await cropDialog.waitFor({ state: "hidden" });
      assert(
        await page
          .getByRole("button", {
            name: `Adjust thumbnail ${n + 1}`,
            exact: true,
          })
          .evaluate((el) => document.activeElement === el),
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
      await page
        .getByRole("button", { name: "Delete setup", exact: true })
        .evaluate((el) => document.activeElement === el),
    );
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/my/setups");
    await titleLink.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: setup.title, exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, `/setups/${id}`);
    assert.equal(await page.getByLabel("Title", { exact: true }).count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Choose photos", exact: true })
        .count(),
      0,
    );
    await geometry();
    await page.reload();
    await page.getByRole("link", { name: "Edit setup", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).waitFor();
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
      await page.getByRole("link", { name: "Edit setup", exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Choose photos", exact: true })
        .count(),
      0,
    );
    await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
    await page
      .getByText("Setup not found or unavailable.", { exact: true })
      .waitFor();
    assert.equal(await page.getByLabel("Title", { exact: true }).count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Choose photos", exact: true })
        .count(),
      0,
    );
    assert.equal(
      mutationCalls,
      beforeNavigationWrites,
      "view/edit navigation sent mutations",
    );
    await geometry();
    // Differential-specific edit validation and historical catalog behavior at every viewport.
    setup = { ...setup, owner_id: user.id };
    manufacturerActive = false;
    await page.goto(`http://127.0.0.1:5173/my/setups/${id}/edit`);
    await page.getByLabel("Rear differential model", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByLabel("Rear differential model", { exact: true })
        .inputValue(),
      differentialModel,
    );
    await page
      .getByRole("button", {
        name: "Change differential manufacturer",
        exact: true,
      })
      .click();
    await page
      .getByText("No active manufacturers available.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByLabel("Rear differential manufacturer", { exact: true })
        .inputValue(),
      manufacturerId,
    );
    await page
      .getByRole("button", { name: "Cancel manufacturer change", exact: true })
      .click();
    const beforeInvalid = mutationCalls;
    await page
      .getByLabel("Rear differential model", { exact: true })
      .fill("x".repeat(201));
    await page.getByRole("button", { name: "Save setup", exact: true }).click();
    await page
      .getByText("Use at most 200 characters.", { exact: true })
      .waitFor();
    assert.equal(mutationCalls, beforeInvalid);
    assert(
      await page
        .getByLabel("Rear differential model", { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    const expectedOtherData = structuredClone(setup.data);
    delete expectedOtherData.rear_differential;
    await page
      .getByRole("button", { name: "Clear rear differential", exact: true })
      .click();
    await page
      .getByLabel("Rear differential tuning notes", { exact: true })
      .fill("Spring only\nNo type required");
    await page.getByRole("button", { name: "Save setup", exact: true }).click();
    await page.getByText("Setup saved.", { exact: true }).waitFor();
    assert.deepEqual(setup.data, {
      ...expectedOtherData,
      rear_differential: { tuning_notes: "Spring only\nNo type required" },
    });
    await page
      .getByRole("button", { name: "Clear rear differential", exact: true })
      .click();
    await page.getByRole("button", { name: "Save setup", exact: true }).click();
    await page.getByText("Setup saved.", { exact: true }).waitFor();
    assert.deepEqual(setup.data, expectedOtherData);
    const typeSelect = page.getByLabel("Rear differential type", {
      exact: true,
    });
    await typeSelect.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    assert.equal(await typeSelect.inputValue(), "spool");
    await page.getByRole("button", { name: "Save setup", exact: true }).click();
    await page.getByText("Setup saved.", { exact: true }).waitFor();
    assert.deepEqual(setup.data.rear_differential, { type: "spool" });
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
    await page.unrouteAll({ behavior: "wait" });
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
