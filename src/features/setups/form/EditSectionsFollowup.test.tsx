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
  "keeps populated %s and unrelated sections intact without a bulk clear action",
  async (id, label) => {
    const { save, change } = show();
    select(label);
    expect(change).toHaveBeenLastCalledWith(id !== "general");
    expect(
      screen.queryByRole("button", { name: /clear current section/i }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save setup" }));
    const body = serializePatch(save.mock.calls[0]![0]);
    expect(body.data).toEqual(populated.data);
    expect(body.notes).toBe(populated.notes);
  },
);
it("manual field edits and confirmed component removal retain unrelated values and errors", async () => {
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
  await user.clear(screen.getByLabelText("Front camber (degrees)"));
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  select("Front");
  await user.click(screen.getByRole("tab", { name: "Link lengths" }));
  await user.click(screen.getByRole("button", { name: "Remove front link 1" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm remove front link 1" }),
  );
  expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue("");
  expect(
    screen.getByRole("region", { name: "Front steering knuckle" }),
  ).toHaveTextContent("Knuckle");

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
