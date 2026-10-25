import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { testSetup } from "../testFixtures";
const form = (setup = testSetup) => {
  const save = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={setup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  return save;
};
const section = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name }),
  );
it("unused controls stay undisclosed; Add keeps an empty editor open and does not focus a keyboard input", async () => {
  form();
  section("Wheels & tires");
  const user = userEvent.setup();
  expect(
    screen.queryByLabelText("Front hex offset (mm)"),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add component" }));
  await user.click(screen.getByRole("button", { name: "Front hex" }));
  const input = screen.getByLabelText("Front hex offset (mm)");
  expect(input).toBeVisible();
  expect(input).not.toHaveFocus();
  fireEvent.change(input, { target: { value: "-" } });
  section("Front");
  section("Wheels & tires");
  expect(input).toHaveValue("-");
  await user.click(screen.getByRole("button", { name: "Done Front hex" }));
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toBeVisible();
  expect(input).toHaveAttribute("aria-invalid", "true");
  fireEvent.change(input, { target: { value: "0" } });
  await user.click(screen.getByRole("button", { name: "Done Front hex" }));
  expect(input).not.toBeVisible();
  expect(screen.getByRole("region", { name: "Front hex" })).toHaveTextContent(
    "Offset (mm): 0",
  );
  await user.click(screen.getByRole("button", { name: "Edit Front hex" }));
  expect(input).toBeVisible();
  expect(input).toHaveValue("0");
});
it("summaries preserve manufacturer/notes/zero-only data and save the whole unseen document", async () => {
  const setup = {
    ...testSetup,
    data: {
      ...testSetup.data,
      front_steering_knuckle: { manufacturer_id: testSetup.chassis.brand_id },
      rear_differential: { tuning_notes: "Only notes" } as const,
      running_gear: { front: { hex: { offset_mm: 0 } } },
    },
  };
  const save = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={setup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  section("Front");
  expect(
    screen.getByRole("region", { name: "Front steering knuckle" }),
  ).toHaveTextContent("Saved manufacturer");
  section("Rear");
  expect(
    screen.getByRole("region", { name: "Rear differential" }),
  ).toHaveTextContent("Only notes");
  const user = userEvent.setup();
  section("Wheels & tires");
  expect(screen.getByRole("region", { name: "Front hex" })).toHaveTextContent(
    "Offset (mm): 0",
  );
  await user.click(screen.getByRole("button", { name: "Remove Front hex" }));
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("button", { name: "Remove Front hex" }),
  ).toHaveFocus();
  expect(screen.getByRole("region", { name: "Front hex" })).toHaveTextContent(
    "Offset (mm): 0",
  );
  await user.click(screen.getByRole("button", { name: "Remove Front hex" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm remove Front hex" }),
  );
  await user.click(screen.getByRole("button", { name: "Add component" }));
  await user.click(screen.getByRole("button", { name: "Front hex" }));
  expect(screen.getByLabelText("Front hex offset (mm)")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(save).toHaveBeenCalled();
  expect(save.mock.calls[0]?.[0].rearDifferential.tuningNotes).toBe(
    "Only notes",
  );
  expect(save.mock.calls[0]?.[0].frontSteeringKnuckle.manufacturerId).toBe(
    testSetup.chassis.brand_id,
  );
});
