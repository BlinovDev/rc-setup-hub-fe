import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { testSetup } from "../testFixtures";
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={testSetup} onSave={vi.fn()} pending={false} />
    </QueryClientProvider>,
  );
it("keeps essentials and one save, switches six sections without rewriting incomplete drafts", async () => {
  show();
  const user = userEvent.setup();
  expect(screen.getByLabelText("Title")).toHaveAttribute(
    "aria-required",
    "true",
  );
  expect(screen.getAllByRole("button", { name: "Save setup" })).toHaveLength(1);
  const nav = screen.getByRole("navigation", {
    name: "Setup sections",
    hidden: true,
  });
  expect(within(nav).getAllByRole("button", { hidden: true })).toHaveLength(6);
  fireEvent.click(
    within(nav).getByRole("button", { name: "Front", hidden: true }),
  );
  fireEvent.change(screen.getByLabelText("Front camber (degrees)"), {
    target: { value: "-" },
  });
  fireEvent.click(
    within(nav).getByRole("button", { name: "Rear", hidden: true }),
  );
  fireEvent.click(
    within(nav).getByRole("button", { name: "Front", hidden: true }),
  );
  expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue("-");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(
    await screen.findByRole("region", { name: "Setup errors" }),
  ).toHaveTextContent("finite");
});
it("reveals a hidden invalid axle and focuses its real control", async () => {
  show();
  fireEvent.change(screen.getByLabelText("Rear toe (degrees)"), {
    target: { value: "Infinity" },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await vi.waitFor(() =>
    expect(screen.getByLabelText("Rear toe (degrees)")).toHaveFocus(),
  );
  expect(screen.getByLabelText("Rear toe (degrees)")).toBeVisible();
});
