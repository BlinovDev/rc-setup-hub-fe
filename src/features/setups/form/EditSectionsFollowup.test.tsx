import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { sections } from "./presentation";
import { serializePatch } from "./serialization";
import { testSetup } from "../testFixtures";
import type { components } from "../../../api/generated/schema";
const populated: components["schemas"]["Setup"] = {
  ...testSetup,
  data: {
    ...testSetup.data,
    front_steering_knuckle: { description: "Knuckle" },
    rear_differential: { tuning_notes: "Diff" },
    running_gear: {
      front: {
        wheel: { model: "界".repeat(200), offset_mm: 0 },
        hex: { offset_mm: 0 },
      },
      rear: { tire: { model: "Partial" } },
    },
  },
};
function show() {
  const save = vi.fn<
    (values: import("./formSchema").SetupFormValues) => Promise<boolean>
  >(async () => false);
  const change = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={populated}
        pending={false}
        onSave={save}
        onSectionViewChange={change}
      />
    </QueryClientProvider>,
  );
  return { save, change };
}
const select = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: new RegExp("^" + name + "(?:\\s*·|$)") }),
  );
it("uses distinct vertical label/value rows for long, zero-only and partial edit previews", () => {
  show();
  select("Wheels & tires");
  const wheel = screen.getByRole("region", { name: "Front wheel" });
  expect(wheel.querySelectorAll("dl > div")).toHaveLength(2);
  expect(wheel.querySelector("dd")).toHaveTextContent("界".repeat(200));
  expect(wheel).toHaveTextContent("Offset (mm): 0");
  expect(
    screen.getByRole("region", { name: "Rear tire" }).querySelector("dd"),
  ).toHaveTextContent("Partial");
  expect(
    screen.queryByLabelText("Front wheel offset (mm)"),
  ).not.toBeInTheDocument();
  expect(
    within(wheel).getByRole("button", { name: "Remove Front wheel" }),
  ).toHaveClass("ui-button-secondary", "component-remove-icon");
});
it.each(sections)(
  "confirms/cancels clearing only %s; full-document save preserves every unrelated section",
  async (id, label) => {
    const { save, change } = show();
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Unrelated draft" },
    });
    select(label);
    expect(change).toHaveBeenLastCalledWith(id !== "general");
    const trigger = screen.getByRole("button", {
      name: `Clear current section: ${label}`,
    });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    const before = serializePatch(save.mock.calls[0]![0]);
    await user.click(trigger);
    await user.click(
      screen.getByRole("button", { name: "Confirm clear current section" }),
    );
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    const after = serializePatch(save.mock.calls[1]![0]);
    const expected = structuredClone(before);
    if (id === "general") expected.notes = null;
    if (id === "front") {
      delete expected.data!.suspension!.front;
      delete expected.data!.front_steering_knuckle;
    }
    if (id === "rear") {
      delete expected.data!.suspension!.rear;
      delete expected.data!.rear_differential;
    }
    if (id === "shocks") delete expected.data!.shocks;
    if (id === "wheels") delete expected.data!.running_gear;
    if (id === "electronics") delete expected.data!.electronics;
    expect(after).toEqual(expected);
    expect(after.title).toBe("Unrelated draft");
    select("General");
    expect(change).toHaveBeenLastCalledWith(false);
  },
);
it("clears only current-section errors and resets cleared link arrays without losing unrelated invalid drafts", async () => {
  const { save } = show();
  const user = userEvent.setup();
  select("Front");
  fireEvent.change(screen.getByLabelText("Front camber (degrees)"), {
    target: { value: "Infinity" },
  });
  select("Rear");
  fireEvent.change(screen.getByLabelText("Rear toe (degrees)"), {
    target: { value: "-" },
  });
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(save).not.toHaveBeenCalled();
  select("Front");
  await user.click(
    screen.getByRole("button", { name: "Clear current section: Front" }),
  );
  expect(
    screen.getByRole("group", { name: "Clear current section?" }),
  ).toHaveTextContent("steering knuckle");
  await user.click(
    screen.getByRole("button", { name: "Confirm clear current section" }),
  );
  expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Add component" }));
  await user.click(
    screen.getByRole("button", { name: "Add Front link lengths" }),
  );
  expect(screen.queryByLabelText("Front link 1 name")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add front link" }));
  expect(screen.getByLabelText("Front link 1 name")).toHaveValue("");
  expect(
    screen.getByRole("region", { name: "Setup errors" }),
  ).toHaveTextContent("Review 1 errors");
  select("Rear");
  expect(screen.getByLabelText("Rear toe (degrees)")).toHaveValue("-");
  expect(screen.getByLabelText("Rear toe (degrees)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
