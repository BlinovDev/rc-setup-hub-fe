import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { testSetup } from "../testFixtures";
import { SetupForm } from "./SetupForm";
import type { SetupFormValues } from "./formSchema";
import { serializePatch } from "./serialization";

it("keeps populated optional fields visible and clears only the chosen block", async () => {
  const save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(
    async () => false,
  );
  const setup = {
    ...testSetup,
    data: {
      ...testSetup.data,
      running_gear: { front: { hex: { offset_mm: 0 } } },
      rear_differential: { tuning_notes: "Keep this" },
    },
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={setup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Wheels & tires" }),
  );
  const offset = screen.getByLabelText("Front hex offset (mm)");
  expect(offset).toBeVisible();
  expect(offset).toHaveValue("0");
  const hex = screen.getByRole("region", { name: "Front hex" });
  await user.click(
    within(hex).getByRole("button", { name: "Remove Front hex" }),
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(
    within(hex).getByRole("button", { name: "Confirm remove Front hex" }),
  );
  expect(offset).toBeVisible();
  expect(offset).toHaveValue("");
  expect(
    within(hex).queryByRole("button", { name: "Remove Front hex" }),
  ).toBeNull();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Rear" }),
  );
  expect(screen.getByLabelText("Rear differential tuning notes")).toHaveValue(
    "Keep this",
  );
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(
    serializePatch(save.mock.calls[0]![0]).data?.running_gear,
  ).toBeUndefined();
  expect(
    serializePatch(save.mock.calls[0]![0]).data?.rear_differential,
  ).toEqual({
    tuning_notes: "Keep this",
  });
});
