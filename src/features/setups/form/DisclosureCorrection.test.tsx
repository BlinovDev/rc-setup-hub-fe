import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { components } from "../../../api/generated/schema";
import { testSetup } from "../testFixtures";
import { SetupForm } from "./SetupForm";
import type { SetupFormValues } from "./formSchema";
import { serializePatch } from "./serialization";

function show(setup: components["schemas"]["Setup"] = testSetup) {
  const save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(
    async () => false,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={setup} onSave={save} pending={false} />
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

it("starts uncommon front parts collapsed while keeping the main suspension fields visible", async () => {
  show();
  select("Front");
  for (const name of [
    "Front top arm — Front spacers (mm)",
    "Front lower arm — Rear spacers (mm)",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
  expect(
    screen.getByLabelText("Front lower arm mount model / part number"),
  ).not.toBeVisible();
  expect(
    screen.getByLabelText("Front knuckle part number / description"),
  ).not.toBeVisible();
  expect(
    document.querySelector<HTMLDetailsElement>(
      '[data-component-disclosure="knuckle"]',
    ),
  ).not.toHaveAttribute("open");
  expect(
    document.querySelector<HTMLDetailsElement>(
      '[data-component-disclosure="front-mount"]',
    ),
  ).not.toHaveAttribute("open");
  expect(
    Array.from(
      document.querySelectorAll<HTMLDetailsElement>(
        '[aria-labelledby="section-front"] [data-component-disclosure]',
      ),
    ).map((disclosure) => disclosure.dataset.componentDisclosure),
  ).toEqual(["knuckle", "front-mount"]);
  expect(screen.queryByRole("button", { name: "Add component" })).toBeNull();
  const user = userEvent.setup();
  await user.click(
    document.querySelector('[data-component-disclosure="knuckle"] summary')!,
  );
  expect(
    screen.getByLabelText("Front knuckle part number / description"),
  ).toBeVisible();
  await user.click(
    document.querySelector(
      '[data-component-disclosure="front-mount"] summary',
    )!,
  );
  expect(
    screen.getByLabelText("Front lower arm mount model / part number"),
  ).toBeVisible();

  select("Rear");
  for (const name of [
    "Rear lower arm mount model / part number",
    "Rear top arm — Front spacers (mm)",
    "Rear lower arm — Rear spacers (mm)",
    "Rear differential model",
  ])
    expect(screen.getByLabelText(name)).toBeVisible();
});

it.each([
  ["knuckle", "Front knuckle part number / description"],
  ["front-mount", "Front lower arm mount model / part number"],
] as const)(
  "validation opens the hidden %s fields and focuses the invalid value",
  async (id, label) => {
    const setup: components["schemas"]["Setup"] = structuredClone(testSetup);
    if (id === "knuckle")
      setup.data.front_steering_knuckle = {
        description: "x".repeat(201),
      };
    else
      setup.data.suspension = {
        ...setup.data.suspension,
        front: {
          ...setup.data.suspension?.front,
          lower_arm_mount: { model: "x".repeat(201) },
        },
      };
    show(setup);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save setup" }));
    await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus());
    expect(
      document.querySelector<HTMLDetailsElement>(
        `[data-component-disclosure="${id}"]`,
      ),
    ).toHaveAttribute("open");
  },
);

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
