import {
  fireEvent,
  screen,
  within,
  type ByRoleOptions,
  type Matcher,
  type SelectorMatcherOptions,
} from "@testing-library/react";
import { componentSpecs } from "./presentation";

// Existing transport/field regressions use the real section/card actions before
// addressing a field. Disclosure/focus/modal tests use raw screen queries instead.
function destination(matcher: Matcher | ByRoleOptions["name"] | undefined) {
  const text =
    typeof matcher === "string"
      ? matcher.toLowerCase()
      : String(matcher).toLowerCase();
  const side = (text.match(/\b(front|rear)\b/)?.[1] ?? "front") as
    "front" | "rear";
  const capital = side === "front" ? "Front" : "Rear";
  let id: string | undefined;
  if (/knuckle/.test(text)) id = "knuckle";
  else if (/differential/.test(text)) id = "differential";
  else if (/lower arm mount/.test(text)) id = side + "-mount";
  else if (/top arm|top.*spacing/.test(text)) id = side + "-top-spacing";
  else if (/lower arm|lower.*spacing/.test(text)) id = side + "-lower-spacing";
  else if (/link/.test(text)) id = side + "-links";
  else if (/piston/.test(text)) id = side + "-piston";
  else if (/seal/.test(text)) id = side + "-seal";
  else if (/shock|spring/.test(text)) id = side + "-shock";
  else if (/wheel/.test(text)) id = side + "-wheel";
  else if (/tire/.test(text)) id = side + "-tire";
  else if (/hex/.test(text)) id = side + "-hex";
  else if (/^(motor|esc|servo|gyro|radio|electronics)$/.test(text))
    id = "electronics";
  else if (text === "notes") id = "notes";
  const spec = componentSpecs.find((c) => c.id === id);
  const section =
    spec?.section ??
    (/camber|caster|toe/.test(text)
      ? side
      : /^(title|notes|visibility|brand|model)$|chassis|photo|thumbnail|crop/.test(
            text,
          )
        ? "general"
        : undefined);
  const label = section
    ? (
        {
          general: "General",
          front: "Front",
          rear: "Rear",
          shocks: "Shocks",
          wheels: "Wheels & tires",
          electronics: "Electronics",
        } as const
      )[section]
    : undefined;
  return { id, spec, label, capital, text };
}
function prepare(matcher: Matcher | ByRoleOptions["name"] | undefined) {
  const d = destination(matcher);
  if (d.label) {
    const target = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".section-sidebar button"),
    ).find((button) => button.textContent?.startsWith(d.label!));
    if (
      target &&
      (target.getAttribute("aria-current") !== "location" ||
        document.querySelector(".setup-section-pane[hidden]"))
    )
      fireEvent.click(target);
  }
  if (
    d.spec &&
    d.id !== "notes" &&
    !d.id?.endsWith("-links") &&
    document.querySelector(".setup-edit-layout") &&
    !document.querySelector(`[data-component="${d.id}"]`)
  ) {
    const pane = document.querySelector(".setup-section-pane")!;
    const trigger = within(pane as HTMLElement).getByRole("button", {
      name: "Add component",
    });
    if (trigger.getAttribute("aria-expanded") !== "true")
      fireEvent.click(trigger);
    fireEvent.click(
      within(pane as HTMLElement).getByRole("button", {
        name: d.spec.label,
      }),
    );
  }
  const tabName = /camber|caster|toe/.test(String(matcher).toLowerCase())
    ? "Angles"
    : d.id?.endsWith("-links")
      ? "Link lengths"
      : undefined;
  if (tabName) {
    const tab = screen.queryByRole("tab", { name: tabName });
    if (tab?.getAttribute("aria-selected") !== "true" && tab)
      fireEvent.click(tab);
  }
  if (
    d.spec &&
    (d.id !== "notes" || !document.querySelector(".setup-edit-layout"))
  ) {
    const region = document.querySelector<HTMLElement>(
      `[data-component="${d.id}"]`,
    );
    const edit =
      region &&
      within(region).queryByRole("button", {
        name: new RegExp("^(?:Edit|Add component:) " + d.spec.label + "$"),
      });
    if (edit && edit.getAttribute("aria-expanded") !== "true")
      fireEvent.click(edit);
  }
  return d;
}
export function setupControl(
  matcher: Matcher,
  options?: SelectorMatcherOptions,
) {
  prepare(matcher);
  if (typeof matcher === "string") {
    const link = /^(Front|Rear) link (\d+) (name|length \(mm\))$/.exec(matcher);
    if (link) {
      const field = document.querySelector<HTMLInputElement>(
        `[name="${link[1]!.toLowerCase()}.link_lengths.${Number(link[2]) - 1}.${link[3] === "name" ? "name" : "length_mm"}"]`,
      );
      if (field) {
        field.closest("details")?.setAttribute("open", "");
        return field;
      }
    }
  }
  return screen.getByLabelText(matcher, options);
}
export function setupButton(options: ByRoleOptions) {
  const name = options.name;
  const d = prepare(name);
  const text = typeof name === "string" ? name : "";
  if (
    /^(Clear |Remove (front|rear) (top|lower) arm spacing)/i.test(text) &&
    d.spec
  ) {
    const region = document.querySelector<HTMLElement>(
      `[data-component="${d.id}"]`,
    )!;
    fireEvent.click(
      within(region).getByRole("button", { name: "Remove " + d.spec.label }),
    );
    return (
      within(region).queryByRole("button", {
        name: "Confirm remove " + d.spec.label,
      }) ??
      (() => {
        if (!document.querySelector(".setup-edit-layout"))
          return within(region).getByRole("button", {
            name: "Add component: " + d.spec!.label,
          });
        const chooser = screen.getByRole("button", { name: "Add component" });
        fireEvent.click(chooser);
        return screen.getByRole("button", { name: d.spec!.label });
      })()
    );
  }
  if (/^Add (top|lower) arm spacing/i.test(text) && d.spec) {
    return screen.getByRole("button", { name: "Edit " + d.spec.label });
  }
  return screen.getByRole("button", options);
}
export function setupGroup(options: ByRoleOptions) {
  prepare(options.name);
  return screen.getByRole("group", options);
}
