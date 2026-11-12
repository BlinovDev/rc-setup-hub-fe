import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { testSetup } from "../testFixtures";

function form(pending = false, blocked = false) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={testSetup}
        onSave={vi.fn()}
        pending={pending}
        blocked={blocked}
      />
    </QueryClientProvider>
  );
}
it("offers seven section buttons and one current location", () => {
  render(form());
  const buttons = within(
    screen.getByRole("navigation", { name: "Setup sections" }),
  ).getAllByRole("button");
  expect(buttons).toHaveLength(7);
  expect(
    buttons.filter(
      (button) => button.getAttribute("aria-current") === "location",
    ),
  ).toHaveLength(1);
});
it("shows the four wheel fields in order and defaults weighing conditions to false", async () => {
  render(form());
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Weight Distribution" }));
  const fields = [
    "Front left (g)",
    "Front right (g)",
    "Rear left (g)",
    "Rear right (g)",
  ];
  expect(
    fields.map((name) => screen.getByRole("textbox", { name })),
  ).toHaveLength(4);
  expect(screen.getByRole("textbox", { name: fields[0]! })).toHaveAttribute(
    "inputmode",
    "decimal",
  );
  expect(
    screen.getByRole("checkbox", { name: "Body installed" }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Battery installed" }),
  ).not.toBeChecked();
});
it.each([
  [false, false],
  [true, false],
  [false, true],
])("keeps one submit action (pending %s, blocked %s)", (pending, blocked) => {
  render(form(pending, blocked));
  const submit = screen.getByRole("button", {
    name: pending ? "Saving…" : "Save setup",
  });
  expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  if (pending || blocked) expect(submit).toBeDisabled();
  else expect(submit).toBeEnabled();
});
it("focuses and describes the first invalid field without hiding sections", async () => {
  render(form());
  const title = screen.getByRole("textbox", { name: "Title" });
  await userEvent.setup().clear(title);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(title).toHaveFocus());
  expect(title).toHaveAttribute("aria-invalid", "true");
  const error = document.getElementById(
    title.getAttribute("aria-describedby")!,
  );
  expect(error).toHaveAttribute("role", "alert");
  expect(error).toBeVisible();
});
it("preserves decimal text input, negative angles, explicit zero and blank values", () => {
  render(form());
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Front" }),
  );
  const front = within(screen.getByRole("group", { name: "Front suspension" }));
  const toe = front.getByRole("textbox", { name: "Front toe (degrees)" });
  const visibleLabel = front.getByText("Front toe", {
    selector: "label",
  });
  expect(visibleLabel).toHaveAttribute("for", toe.id);
  expect(toe).toHaveAccessibleName("Front toe (degrees)");
  expect(toe).toHaveAttribute("aria-label", "Front toe (degrees)");
  expect(
    within(visibleLabel.parentElement!).getByText("deg", { exact: true }),
  ).toBeVisible();
  expect(toe).toHaveValue("0");
  expect(toe).toHaveAttribute("type", "text");
  expect(toe).toHaveAttribute("inputmode", "decimal");
  expect(toe).toHaveAttribute("autocomplete", "off");
  expect(
    screen.getByRole("textbox", { name: "Front camber (degrees)" }),
  ).toHaveValue("-1.5");
  expect(
    screen.getByRole("textbox", { name: "Front caster (degrees)" }),
  ).toHaveValue("");
});
