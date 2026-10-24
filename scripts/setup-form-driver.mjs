// Real UI actions for the existing data/photo browser regressions. The dedicated
// disclosure checks use page directly so initial hidden state is independently tested.
export function setupFormDriver(page) {
  const destination = (name) => {
    const text = String(name).toLowerCase();
    const side = text.match(/\b(front|rear)\b/)?.[1] ?? "front";
    const label = side === "front" ? "Front" : "Rear";
    if (/knuckle/.test(text)) return ["Front", "Front steering knuckle"];
    if (/differential/.test(text)) return ["Rear", "Rear differential"];
    if (/lower arm mount/.test(text))
      return [label, `${label} lower arm mount`];
    if (/(top|lower) arm/.test(text))
      return [
        label,
        `${label} ${text.includes("top") ? "top" : "lower"} arm spacing`,
      ];
    if (/link/.test(text)) return [label, `${label} link lengths`];
    if (/piston/.test(text)) return ["Shocks", `${label} shock piston`];
    if (/seal/.test(text)) return ["Shocks", `${label} shock seal`];
    if (/shock|spring/.test(text)) return ["Shocks", `${label} shock setup`];
    if (/wheel|tire|hex/.test(text))
      return [
        "Wheels & tires",
        `${label} ${text.includes("wheel") ? "wheel" : text.includes("tire") ? "tire" : "hex"}`,
      ];
    if (/^(motor|esc|servo|gyro|radio|electronics)$/.test(text))
      return ["Electronics", "Electronics"];
    if (text === "notes") return ["General", "Setup notes"];
    return [
      /camber|caster|toe/.test(text)
        ? label
        : /^(title|notes|visibility|brand|model)$|chassis|photo|thumbnail|crop/.test(
              text,
            )
          ? "General"
          : null,
      null,
    ];
  };
  const select = async (label) => {
    if (!label) return;
    const desktop = await page.locator(".section-sidebar").isVisible();
    const nav = desktop
      ? page.getByRole("navigation", { name: "Setup sections", exact: true })
      : page
          .getByRole("dialog", { name: "Setup sections", exact: true })
          .getByRole("navigation");
    if (!desktop)
      await page.getByRole("button", { name: /^Sections ·/ }).click();
    await nav
      .getByRole("button", { name: new RegExp("^" + label + "(?:\\s*·|$)") })
      .click();
    if (!desktop)
      await page
        .getByRole("dialog", { name: "Setup sections", exact: true })
        .waitFor({ state: "hidden" });
  };
  const prepare = async (name) => {
    const [section, component] = destination(name);
    if (!(await page.locator("form").count())) {
      // Initial route data can still be loading. Wait for its real form or its
      // explicit unavailable state before looking for a lazily mounted editor.
      const editorRoute = /^\/my\/setups\/(new|[^/]+\/edit)$/.test(
        new URL(page.url()).pathname,
      );
      if (
        editorRoute &&
        (component || section || String(name) === "Title") &&
        !(await page.getByText("Setup created.", { exact: true }).count())
      ) {
        await page
          .locator("form")
          .or(
            page.getByText("Setup not found or unavailable.", { exact: true }),
          )
          .first()
          .waitFor();
      }
      if (!(await page.locator("form").count())) return component;
    }
    if (
      section &&
      ((await page.locator(".setup-section-pane[hidden]").count()) ||
        !(await page
          .locator(".section-sidebar button")
          .filter({ hasText: new RegExp("^" + section + "(?:\\s*·|$)") })
          .getAttribute("aria-current")))
    )
      await select(section);
    if (
      component &&
      (await page.locator(".setup-edit-layout").count()) &&
      component !== "Setup notes"
    ) {
      const existing = page.locator(
        `.component-card[aria-label="${component}"]`,
      );
      if (!(await existing.count())) {
        const chooser = page.getByRole("button", {
          name: "Add component",
          exact: true,
        });
        if ((await chooser.getAttribute("aria-expanded")) !== "true")
          await chooser.click();
        await page
          .getByRole("button", { name: "Add " + component, exact: true })
          .click();
      }
    }
    if (
      component &&
      (component !== "Setup notes" ||
        !(await page.locator(".setup-edit-layout").count()))
    ) {
      const card = page.locator(`.component-card[aria-label="${component}"]`);
      const edit = card.getByRole("button", {
        name: new RegExp("^(Edit|Add component:) " + component + "$"),
      });
      if ((await edit.getAttribute("aria-expanded")) !== "true")
        await edit.click();
    }
    return component;
  };
  return {
    select,
    field: async (...args) => {
      await prepare(args[0]);
      return page.getByLabel(...args);
    },
    group: async (options) => {
      await prepare(options.name);
      return page.getByRole("group", options);
    },
    button: async (options) => {
      const name = String(options.name);
      const component = await prepare(name);
      if (
        /^Clear |^Remove (front|rear) (top|lower) arm spacing/i.test(name) &&
        component
      ) {
        await page
          .getByRole("button", { name: "Remove " + component, exact: true })
          .click();
        const confirm = page.getByRole("button", {
          name: "Confirm remove " + component,
          exact: true,
        });
        if (await confirm.count()) return confirm;
        // Empty editors clear immediately; return the now-visible Add action.
        if (await page.locator(".setup-edit-layout").count()) {
          const chooser = page.getByRole("button", {
            name: "Add component",
            exact: true,
          });
          if ((await chooser.getAttribute("aria-expanded")) !== "true")
            await chooser.click();
          return page.getByRole("button", {
            name: "Add " + component,
            exact: true,
          });
        }
        return page.getByRole("button", {
          name: "Add component: " + component,
          exact: true,
        });
      }
      if (/^Add (top|lower) arm spacing/i.test(name) && component)
        return page.getByRole("button", {
          name: "Edit " + component,
          exact: true,
        });
      return page.getByRole("button", options);
    },
  };
}
