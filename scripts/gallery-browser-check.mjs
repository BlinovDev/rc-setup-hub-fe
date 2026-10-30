import assert from "node:assert/strict";

// Reuses the photo suite's credentialed/no-store API fixture. No gallery mutations.
export async function checkGallery(page, context, { width, height, load }) {
  const mobile = width < 768;
  const gallery = page.getByRole("region", { name: "Setup gallery" });
  const track = gallery.getByRole("group", { name: "Photo slides" });
  const viewer = page.getByRole("dialog", { name: "Enlarged setup photo" });
  const status = (n, count) =>
    gallery.getByText(`Photo ${n} of ${count}`, { exact: true });
  const shot = (name) =>
    page.screenshot({
      path: `artifacts/photo-qa/gallery-${name}-${width}x${height}.png`,
    });
  const assertImage = async (image) => {
    await image.waitFor();
    await page.waitForFunction(
      (el) => el.complete && el.naturalWidth > 0,
      await image.elementHandle(),
    );
    await image.evaluate((el) => el.decode());
    const dimensions = await image.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        box: [box.width, box.height],
        natural: [el.naturalWidth, el.naturalHeight],
        objectFit: getComputedStyle(el).objectFit,
      };
    });
    assert(
      dimensions.box[0] > 0 &&
        dimensions.box[1] > 0 &&
        Math.abs(
          dimensions.box[0] / dimensions.box[1] -
            dimensions.natural[0] / dimensions.natural[1],
        ) < 0.02 &&
        dimensions.objectFit === "contain",
      `natural full-photo aspect must be retained: ${JSON.stringify(dimensions)}`,
    );
  };
  const noMobileButtons = async (scope) => {
    for (const button of await scope.locator(".gallery-chevron").all())
      assert.equal(
        await button.isVisible(),
        false,
        "mobile has no visible navigation buttons",
      );
  };
  const touch = mobile ? await context.newCDPSession(page) : undefined;
  const swipe = async (target, vertical = false) => {
    const box = await target.boundingBox();
    const startX = box.x + box.width * 0.8;
    const startY = Math.max(
      40,
      Math.min(height - 90, box.y + box.height * 0.6),
    );
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let n = 1; n <= 10; n++) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: vertical ? startX : startX - box.width * 0.06 * n,
            y: vertical
              ? startY - (Math.min(180, box.height * 0.5) * n) / 10
              : startY,
          },
        ],
      });
      await page.waitForTimeout(16); // Finger cadence, not CI status polling.
    }
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  try {
    for (const count of [0, 1, 2, 3, 4, 10]) {
      await load(count, "owner");
      if (!count) {
        await page.getByText("No photos yet.", { exact: true }).waitFor();
        continue;
      }
      await status(1, count).waitFor();
      await track.scrollIntoViewIfNeeded();
      await assertImage(gallery.getByAltText("Setup photo 1", { exact: true }));
      assert.equal(
        await gallery.getByText("Enlarge", { exact: true }).count(),
        0,
      );
      assert.equal(
        await gallery.locator(".gallery-thumbnails,.gallery-controls").count(),
        0,
      );
      assert(
        await gallery.evaluate((el) => {
          const heading = el
            .closest("article")
            .querySelector("h2")
            .getBoundingClientRect();
          return (
            Math.abs(el.getBoundingClientRect().left - heading.left) < 1 &&
            getComputedStyle(el).maxWidth === "none"
          );
        }),
        "gallery aligns to the title/content edge",
      );
      assert(
        await gallery
          .locator(".photo-hero")
          .first()
          .evaluate((el) => {
            const css = getComputedStyle(el);
            return (
              css.backgroundColor === "rgba(0, 0, 0, 0)" &&
              css.borderTopWidth === "0px" &&
              css.paddingTop === "0px"
            );
          }),
        "no decorative frame, gray background or padding",
      );
      const visible = await track.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return Array.from(el.children).filter((slide) => {
          const b = slide.getBoundingClientRect();
          return b.left >= box.left - 1 && b.right <= box.right + 1;
        }).length;
      });
      assert.equal(
        visible,
        Math.min(count, mobile ? 1 : width >= 1200 ? 4 : 3),
      );
      if (mobile) await noMobileButtons(gallery);
      if (count === 1) {
        assert.equal(await gallery.locator(".gallery-chevron").count(), 0);
        await gallery
          .getByRole("button", { name: "Enlarge photo 1 (cover)" })
          .click();
        assert.equal(await viewer.locator(".gallery-chevron").count(), 0);
        await viewer
          .getByAltText("Enlarged setup photo 1", { exact: true })
          .click();
        await viewer.waitFor({ state: "hidden" });
      }
      if (count !== 10) continue;
      // Rest evidence before any gallery navigation or expansion.
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot("rest");
      await track.scrollIntoViewIfNeeded();
      if (mobile) {
        await swipe(track);
        await status(2, count).waitFor();
        await page.waitForFunction(
          (el) => Math.abs(el.scrollLeft - el.clientWidth) < 1,
          await track.elementHandle(),
        );
        assert.equal(await viewer.count(), 0, "swiping must not open viewer");
        await track.scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => scrollY);
        await swipe(track, true);
        await page.waitForFunction((y) => scrollY > y + 10, before);
        assert.equal(
          await viewer.count(),
          0,
          "vertical drag must not open viewer",
        );
      } else {
        const next = gallery.getByRole("button", {
          name: "Next gallery photo",
        });
        const slot = await track.evaluate(
          (el) => el.children[1].offsetLeft - el.children[0].offsetLeft,
        );
        await next.click();
        await status(2, count).waitFor();
        assert(
          Math.abs((await track.evaluate((el) => el.scrollLeft)) - slot) < 2,
          "one chevron step = exactly one photo",
        );
        await next.click();
        await status(3, count).waitFor();
        assert(
          Math.abs((await track.evaluate((el) => el.scrollLeft)) - 2 * slot) <
            2,
        );
      }
      await track.scrollIntoViewIfNeeded();
      await shot("scrolled");
      await track.focus();
      await page.keyboard.press("Home");
      await status(1, count).waitFor();
      const opener = gallery.getByRole("button", {
        name: "Enlarge photo 1 (cover)",
      });
      await opener.click();
      await viewer.waitFor();
      await assertImage(
        viewer.getByAltText("Enlarged setup photo 1", { exact: true }),
      );
      await shot("expanded");
      if (mobile) {
        await noMobileButtons(viewer);
        await swipe(
          viewer.getByRole("group", { name: "Enlarged photo slides" }),
        );
        await viewer
          .getByText(`Photo 2 of ${count}`, { exact: true })
          .waitFor();
        await page.waitForFunction(
          (el) => Math.abs(el.scrollLeft - el.clientWidth) < 1,
          await viewer
            .getByRole("group", { name: "Enlarged photo slides" })
            .elementHandle(),
        );
        assert(await viewer.isVisible(), "fullscreen swipe must not dismiss");
        await assertImage(
          viewer.getByAltText("Enlarged setup photo 2", { exact: true }),
        );
        await shot("expanded-swiped");
        await viewer
          .getByAltText("Enlarged setup photo 2", { exact: true })
          .tap();
      } else {
        await viewer.getByRole("button", { name: "Next photo" }).click();
        await viewer
          .getByText(`Photo 2 of ${count}`, { exact: true })
          .waitFor();
        assert(await viewer.isVisible(), "chevrons never close image");
        await page.keyboard.press("ArrowRight");
        await viewer
          .getByText(`Photo 3 of ${count}`, { exact: true })
          .waitFor();
        await page.keyboard.press("ArrowLeft");
        await viewer
          .getByText(`Photo 2 of ${count}`, { exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
      }
      await viewer.waitFor({ state: "hidden" });
      assert(
        await opener.evaluate((el) => el === document.activeElement),
        "restore trigger focus without scroll jump",
      );
      await track.focus();
      await page.keyboard.press("End");
      if (!mobile)
        await page.waitForFunction(
          () =>
            document.querySelector(".gallery-strip .gallery-next")?.disabled ===
            true,
        );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no document overflow",
      );
    }
    for (const owner of ["public", "friends"]) {
      await load(4, owner);
      await status(1, 4).waitFor();
      await assertImage(gallery.getByAltText("Setup photo 1", { exact: true }));
      assert.equal(
        await page
          .getByRole("link", { name: "Edit setup", exact: true })
          .count(),
        0,
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await track.evaluate((el) => getComputedStyle(el).scrollBehavior),
      "auto",
    );
    console.log(
      `PASS gallery ${width}x${height}: 0/1/2/3/4/10, aspect/frame/alignment, native swipe/tap, one-step desktop, focus/keys, visitor, reduced motion`,
    );
  } finally {
    await touch?.detach();
  }
}
