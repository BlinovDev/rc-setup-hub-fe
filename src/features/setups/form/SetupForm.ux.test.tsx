import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
it("offers section anchors to all visible sections", () => {
  render(form());
  const links = within(
    screen.getByRole("navigation", { name: "Setup sections" }),
  ).getAllByRole("link");
  expect(links).toHaveLength(6);
  for (const link of links) {
    const target = document.querySelector(link.getAttribute("href")!);
    expect(target).toBeVisible();
    expect(target?.tagName).toBe("FIELDSET");
  }
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
  expect(title).toHaveFocus();
  expect(title).toHaveAttribute("aria-invalid", "true");
  const error = document.getElementById(
    title.getAttribute("aria-describedby")!,
  );
  expect(error).toHaveAttribute("role", "alert");
  expect(error).toBeVisible();
});
it("preserves decimal text input, negative angles, explicit zero and blank values", () => {
  render(form());
  const toe = screen.getByRole("textbox", { name: "Front toe (degrees)" });
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
