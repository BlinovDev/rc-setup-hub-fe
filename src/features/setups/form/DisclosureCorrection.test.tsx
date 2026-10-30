import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { sections } from "./presentation";
import { serializePatch } from "./serialization";
import type { SetupFormValues } from "./formSchema";
import { testSetup } from "../testFixtures";
function show() {
  const save = vi.fn<(v: SetupFormValues) => Promise<boolean>>(
    async () => false,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={testSetup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  return save;
}
const select = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name }),
  );
it.each(sections.map(([, label]) => label))(
  "offers no section-wide Clear action in %s and keeps the full document",
  async (label) => {
    const save = show();
    select(label);
    expect(
      screen.queryByRole("button", { name: /clear current section/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".section-clear")).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save setup" }));
    const body = serializePatch(save.mock.calls[0]![0]);
    expect(body.data).toEqual(testSetup.data);
    expect(body.notes).toBe(testSetup.notes);
  },
);
it("uses one associated disclosure trigger, keyboard toggle/Escape and only actual component choices", async () => {
  show();
  select("Front");
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Add component" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(
    document.getElementById(trigger.getAttribute("aria-controls")!),
  ).toHaveAttribute("hidden");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const panel = screen.getByRole("group", { name: "Available components" });
  expect(
    within(panel)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual([
    "Add front steering knuckle",
    "Add front lower arm mount",
    "Add front top arm spacing",
    "Add front lower arm spacing",
  ]);
  expect(
    within(panel).queryByRole("button", { name: /close/i }),
  ).not.toBeInTheDocument();
  await user.click(trigger);
  expect(panel).not.toBeVisible();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.keyboard(" ");
  expect(panel).toBeVisible();
  within(panel)
    .getByRole("button", { name: "Add front lower arm mount" })
    .focus();
  await user.keyboard("{Escape}");
  expect(panel).not.toBeVisible();
  expect(trigger).toHaveFocus();
});
it("selection closes choices and opens only its editor while retaining other drafts and full data", async () => {
  const save = show();
  const user = userEvent.setup();
  select("Front");
  fireEvent.change(screen.getByLabelText("Front toe (degrees)"), {
    target: { value: "0,125" },
  });
  const trigger = screen.getByRole("button", { name: "Add component" });
  await user.click(trigger);
  await user.click(
    screen.getByRole("button", { name: "Add front lower arm mount" }),
  );
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("group", { name: "Available components" }),
  ).not.toBeInTheDocument();
  const model = screen.getByLabelText(
    "Front lower arm mount model / part number",
  );
  expect(model).toBeVisible();
  expect(model).toHaveFocus();
  fireEvent.change(model, { target: { value: "Added mount" } });
  await user.click(
    screen.getByRole("button", { name: "Done Front lower arm mount" }),
  );
  await user.click(trigger);
  expect(
    within(
      screen.getByRole("group", { name: "Available components" }),
    ).queryByRole("button", { name: "Add front lower arm mount" }),
  ).not.toBeInTheDocument();
  await user.click(trigger);
  select("Rear");
  select("Front");
  expect(screen.getByLabelText("Front toe (degrees)")).toHaveValue("0,125");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(serializePatch(save.mock.calls[0]![0]).data).toEqual({
    ...testSetup.data,
    suspension: {
      ...testSetup.data.suspension,
      front: {
        ...testSetup.data.suspension.front,
        toe_deg: 0.125,
        lower_arm_mount: { model: "Added mount" },
      },
    },
  });
});
it("disables the disclosure when all components in the section are already configured", () => {
  show();
  select("Electronics");
  const trigger = screen.getByRole("button", { name: "Add component" });
  expect(trigger).toBeDisabled();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("group", { name: "Available components" }),
  ).not.toBeInTheDocument();
});
