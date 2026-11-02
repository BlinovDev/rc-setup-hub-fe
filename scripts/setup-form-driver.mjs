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
    if (/piston|seal/.test(text)) return ["Shocks", `${label} shock setup`];
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
    await page.locator("form").waitFor({ state: "visible" });
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
    const sectionId = {
      General: "general",
      Front: "front",
      Rear: "rear",
      Shocks: "shocks",
      "Wheels & tires": "wheels",
      Electronics: "electronics",
    }[label];
    await page.locator("#section-" + sectionId).waitFor({ state: "visible" });
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
    if (component && /^(Shocks|Wheels & tires)$/.test(section ?? "")) {
      const axle = /\brear\b/i.test(String(name)) ? "Rear" : "Front";
      const axleTabs = page.getByRole("tablist", {
        name: section === "Shocks" ? "Shock axle" : "Wheels and tires axle",
      });
      const tab = axleTabs.getByRole("tab", { name: axle, exact: true });
      if (
        (await tab.count()) &&
        (await tab.getAttribute("aria-selected")) !== "true"
      )
        await tab.click();
    }
    const tabName = /camber|caster|toe/.test(String(name).toLowerCase())
      ? "Angles"
      : component?.endsWith("link lengths")
        ? "Link lengths"
        : null;
    if (tabName) {
      const tab = page.getByRole("tab", { name: tabName, exact: true });
      if (
        (await tab.count()) &&
        (await tab.getAttribute("aria-selected")) !== "true"
      )
        await tab.click();
    }
    if (
      component === "Front steering knuckle" ||
      component === "Front lower arm mount"
    ) {
      const id =
        component === "Front steering knuckle" ? "knuckle" : "front-mount";
      const disclosure = page.locator(
        `details[data-component-disclosure="${id}"]`,
      );
      if (await disclosure.count())
        await disclosure.evaluate((el) => (el.open = true));
    }
    return component;
  };
  return {
    select,
    field: async (...args) => {
      await prepare(args[0]);
      const match = /^(Front|Rear) link (\d+) (name|length \(mm\))$/.exec(
        String(args[0]),
      );
      if (match) {
        const input = page.locator(
          `[name="${match[1].toLowerCase()}.link_lengths.${Number(match[2]) - 1}.${match[3] === "name" ? "name" : "length_mm"}"]`,
        );
        if (await input.count()) {
          await input.evaluate((el) =>
            el.closest("details")?.setAttribute("open", ""),
          );
          return input;
        }
      }
      return page.getByLabel(...args);
    },
    group: async (options) => {
      await prepare(options.name);
      return page.getByRole("group", options);
    },
    button: async (options) => {
      const name = String(options.name);
      const component = await prepare(name);
      if (/^Clear /i.test(name) && component) {
        await page
          .getByRole("button", { name: "Remove " + component, exact: true })
          .click();
        return page.getByRole("button", {
          name: "Confirm remove " + component,
          exact: true,
        });
      }
      return page.getByRole("button", options);
    },
  };
}
