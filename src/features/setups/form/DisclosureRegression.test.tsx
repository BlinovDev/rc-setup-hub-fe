import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import type { components } from "../../../api/generated/schema";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { testSetup } from "../testFixtures";
import { SetupForm } from "./SetupForm";
import type { SetupFormValues } from "./formSchema";
import { serializePatch } from "./serialization";
const select = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name }),
  );
function renderForm(setup: components["schemas"]["Setup"], save = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm setup={setup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  return save;
}
it("validates unseen optional values, reveals the editor, and focuses after registration", async () => {
  const save = renderForm({
    ...testSetup,
    data: {
      ...testSetup.data,
      running_gear: { rear: { wheel: { offset_mm: 1.5 } } },
    },
  });
  expect(
    screen.queryByLabelText("Rear wheel offset (mm)"),
  ).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Rear wheel offset (mm)")).toHaveFocus(),
  );
  expect(screen.getByLabelText("Rear wheel offset (mm)")).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Setup errors" }),
  ).toHaveTextContent("Wheels & tires");
  expect(save).not.toHaveBeenCalled();
});
it("aggregate link errors reveal the stable field array and focus an actionable associated destination", async () => {
  renderForm({
    ...testSetup,
    data: {
      suspension: {
        front: {
          link_lengths: Array.from({ length: 101 }, (_, index) => ({
            name: "Link " + index,
            length_mm: 1,
          })),
        },
      },
    },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add front link" }),
    ).toHaveFocus(),
  );
  expect(
    screen.getByRole("button", { name: "Add front link" }),
  ).toHaveAccessibleDescription("Use at most 100 links.");
  expect(screen.getByLabelText("Front link 101 name")).toHaveValue("Link 100");
});
it("collapse and section switches preserve manufacturer choosing/cancel snapshots without eager catalogue loads", async () => {
  const old = testSetup.chassis.brand_id,
    active = "11111111-1111-4111-8111-111111111111";
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
      calls++;
      return HttpResponse.json([{ id: active, name: "Active" }]);
    }),
  );
  renderForm({
    ...testSetup,
    data: {
      front_steering_knuckle: { manufacturer_id: old, description: "Old part" },
    },
    front_steering_knuckle_manufacturer: { id: old, name: "Historical" },
  });
  const user = userEvent.setup();
  select("Front");
  expect(calls).toBe(0);
  await user.click(
    screen.getByRole("button", { name: "Edit Front steering knuckle" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Change knuckle manufacturer" }),
  );
  await screen.findByRole("option", { name: "Active" });
  await user.selectOptions(
    screen.getByLabelText("Front knuckle manufacturer"),
    active,
  );
  fireEvent.change(
    screen.getByLabelText("Front knuckle part number / description"),
    { target: { value: "Draft part" } },
  );
  await user.click(
    screen.getByRole("button", { name: "Done Front steering knuckle" }),
  );
  select("Rear");
  select("Front");
  await user.click(
    screen.getByRole("button", { name: "Edit Front steering knuckle" }),
  );
  expect(screen.getByLabelText("Front knuckle manufacturer")).toHaveValue(
    active,
  );
  await user.click(
    screen.getByRole("button", { name: "Cancel manufacturer change" }),
  );
  expect(
    screen.getByText("Front knuckle manufacturer: Historical"),
  ).toBeVisible();
  expect(
    screen.getByLabelText("Front knuckle part number / description"),
  ).toHaveValue("Draft part");
  expect(calls).toBe(1);
});
it("saving retains presentation state while resetting dirty baseline and preserving the full unseen document", async () => {
  const saved = vi.fn(async (values: SetupFormValues) => {
    expect(values.title).toBe(testSetup.title);
    return true;
  });
  renderForm(testSetup, saved);
  select("Front");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Edit Front link lengths" }));
  const field = screen.getByLabelText("Front link 1 length (mm)");
  fireEvent.change(field, { target: { value: "25,123456789" } });
  select("General");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const payload = serializePatch(saved.mock.calls[0]![0]);
  expect(payload.data).toMatchObject({
    ...testSetup.data,
    suspension: {
      ...testSetup.data.suspension,
      front: {
        ...testSetup.data.suspension.front,
        link_lengths: [{ name: "Upper", length_mm: 25.123456789 }],
      },
    },
  });
  select("Front");
  expect(screen.getByLabelText("Front link 1 length (mm)")).toHaveValue(
    "25,123456789",
  );
  expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
});
it("a hidden historical manufacturer validation error focuses its actionable Change control", async () => {
  renderForm({
    ...testSetup,
    data: { front_steering_knuckle: { manufacturer_id: "invalid" } },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  const change = await screen.findByRole("button", {
    name: "Change knuckle manufacturer",
  });
  await waitFor(() => expect(change).toHaveFocus());
  expect(change).toHaveAttribute("aria-invalid", "true");
  expect(change).toHaveAccessibleDescription(/UUID/i);
});
