import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { testSetup } from "../testFixtures";
import { SetupForm } from "./SetupForm";
import type { SetupFormValues } from "./formSchema";
import { serializePatch } from "./serialization";

function show() {
  const save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(
    async () => false,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={testSetup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  return save;
}

const select = (label: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: label }),
  );

it("shows optional front and rear suspension fields without an add chooser", () => {
  show();
  select("Front");
  for (const name of [
    "Front lower arm mount model / part number",
    "Front top arm — Front spacers (mm)",
    "Front lower arm — Rear spacers (mm)",
    "Front knuckle part number / description",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add component" })).toBeNull();

  select("Rear");
  for (const name of [
    "Rear lower arm mount model / part number",
    "Rear top arm — Front spacers (mm)",
    "Rear lower arm — Rear spacers (mm)",
    "Rear differential model",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
});

it("shows one complete shock form per selected axle and preserves both drafts", async () => {
  show();
  select("Shocks");
  const user = userEvent.setup();
  const front = screen.getByRole("tab", { name: "Front" });
  const rear = screen.getByRole("tab", { name: "Rear" });
  expect(front).toHaveAttribute("aria-selected", "true");
  const frontModel = screen.getByLabelText("Front shock model");
  for (const name of [
    "Front shock manufacturer",
    "Front spring manufacturer",
    "Front spring color",
    "Front shock oil (cSt)",
    "Front piston hole count",
    "Front piston hole diameter (mm)",
    "Front piston notes",
    "Front seal type",
    "Front seal description",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
  await user.clear(frontModel);
  await user.type(frontModel, "Front build");
  await user.click(rear);
  expect(screen.getByLabelText("Rear piston hole count")).toBeVisible();
  expect(screen.getByLabelText("Rear seal type")).toBeVisible();
  expect(frontModel).not.toBeVisible();
  const rearModel = screen.getByLabelText("Rear shock model");
  await user.clear(rearModel);
  await user.type(rearModel, "Rear build");
  rear.focus();
  await user.keyboard("{ArrowLeft}");
  expect(front).toHaveAttribute("aria-selected", "true");
  expect(frontModel).toHaveValue("Front build");
  expect(rearModel).toHaveValue("Rear build");
});

it("shows hex, wheel and tire fields together on the selected axle", async () => {
  show();
  select("Wheels & tires");
  const user = userEvent.setup();
  const front = screen.getByRole("tab", { name: "Front" });
  const rear = screen.getByRole("tab", { name: "Rear" });
  for (const name of [
    "Front hex offset (mm)",
    "Front wheel model",
    "Front wheel offset (mm)",
    "Front tire model",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Change front wheel manufacturer" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Change front tire manufacturer" }),
  ).toBeVisible();
  await user.type(screen.getByLabelText("Front tire model"), "Front tire");
  await user.click(rear);
  expect(screen.getByLabelText("Rear hex offset (mm)")).toBeVisible();
  expect(screen.getByLabelText("Rear wheel model")).toBeVisible();
  expect(screen.getByLabelText("Rear tire model")).toBeVisible();
  expect(screen.getByLabelText("Front tire model")).not.toBeVisible();
  await user.type(screen.getByLabelText("Rear tire model"), "Rear tire");
  await user.click(front);
  expect(screen.getByLabelText("Front tire model")).toHaveValue("Front tire");
  expect(screen.getByLabelText("Rear tire model")).toHaveValue("Rear tire");
});

it("keeps electronics inputs directly available and omits all blank optional fields", async () => {
  const save = show();
  select("Electronics");
  for (const name of ["Motor", "ESC", "Servo", "Gyro", "Radio"])
    expect(screen.getByLabelText(name)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add component" })).toBeNull();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  expect(serializePatch(save.mock.calls[0]![0]).data).toEqual(testSetup.data);
});
