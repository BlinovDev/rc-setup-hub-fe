import {
  fireEvent,
  screen,
  within,
  type ByRoleOptions,
  type Matcher,
  type SelectorMatcherOptions,
} from "@testing-library/react";
import { componentSpecs } from "./presentation";

// Existing transport/field regressions select the relevant section and axle view
// before addressing a field. Focus/modal tests use raw screen queries instead.
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
  else if (/piston|seal|shock|spring/.test(text)) id = side + "-shock";
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
  const axleTab =
    d.label === "Shocks" || d.label === "Wheels & tires"
      ? screen.queryByRole("tab", { name: d.capital })
      : null;
  if (axleTab?.getAttribute("aria-selected") !== "true" && axleTab)
    fireEvent.click(axleTab);
  if (d.id === "knuckle" || d.id === "front-mount") {
    const disclosure = document.querySelector<HTMLDetailsElement>(
      `[data-component-disclosure="${d.id}"]`,
    );
    if (disclosure) disclosure.open = true;
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
  const d = prepare(options.name);
  if (typeof options.name === "string" && /^Clear /i.test(options.name)) {
    if (!d.spec) throw new Error(`No component matches ${options.name}`);
    const region = screen.getByRole("region", { name: d.spec.label });
    fireEvent.click(
      within(region).getByRole("button", { name: `Remove ${d.spec.label}` }),
    );
    return within(region).getByRole("button", {
      name: `Confirm remove ${d.spec.label}`,
    });
  }
  return screen.getByRole("button", options);
}
export function setupGroup(options: ByRoleOptions) {
  prepare(options.name);
  return screen.getByRole("group", options);
}
