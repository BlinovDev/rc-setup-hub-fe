import { waitFor } from "@testing-library/react";
import { setupControl, setupButton } from "./form/testDriver";
import type { components } from "../../api/generated/schema";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { activeBrand, mockActiveCatalog, renderSetupRoute } from "./testUtils";

type Schemas = components["schemas"];
const setup: Schemas["Setup"] = {
  ...testSetup,
  rear_differential_manufacturer: {
    id: testSetup.chassis.brand_id,
    name: "Historical manufacturer",
  },
  data: {
    ...testSetup.data,
    rear_differential: {
      type: "lsd",
      manufacturer_id: testSetup.chassis.brand_id,
      model: "Rear diff",
      tuning_notes: "Spring preload\nTwo gears",
    },
  },
};
const editPath = `/my/setups/${setup.id}/edit`;
const fill = (label: string, value: string) =>
  fireEvent.change(setupControl(label), { target: { value } });
function detail(value = setup) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      HttpResponse.json(value),
    ),
  );
}

it("creates optional differential through the shared credentialed client, independently of chassis", async () => {
  mockActiveCatalog();
  let received: Schemas["CreateSetup"] | undefined;
  let catalogCalls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, ({ request }) => {
      expect(request.credentials).toBe("include");
      catalogCalls++;
      return HttpResponse.json([{ id: activeBrand, name: "MST" }]);
    }),
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      received = (await request.json()) as Schemas["CreateSetup"];
      return HttpResponse.json(setup, { status: 201 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([setup])),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  setupControl("Rear differential model");
  fill("Title", "Differential");
  const user = userEvent.setup();
  await user.selectOptions(setupControl("Rear differential type"), "gear");
  const manufacturer = setupControl("Rear differential manufacturer");
  await within(manufacturer).findByRole("option", { name: "MST" });
  await user.selectOptions(manufacturer, activeBrand);
  fill("Rear differential model", " Diff ");
  fill("Rear differential tuning notes", " Oil 10000\nTwo gears ");
  fill("Front toe (degrees)", "0");
  fill("Rear camber (degrees)", "-1,25");
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(received).toMatchObject({
    chassis_model_id: null,
    data: {
      rear_differential: {
        type: "gear",
        manufacturer_id: activeBrand,
        model: "Diff",
        tuning_notes: "Oil 10000\nTwo gears",
      },
      suspension: { front: { toe_deg: 0 }, rear: { camber_deg: -1.25 } },
    },
  });
  expect(catalogCalls).toBe(1);
});

it("preserves an inactive historical manufacturer and full data on unrelated edits without catalog requests", async () => {
  detail();
  let catalogCalls = 0;
  let received: Schemas["PatchSetup"] | undefined;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
      catalogCalls++;
      return HttpResponse.json([]);
    }),
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      received = (await request.json()) as Schemas["PatchSetup"];
      return HttpResponse.json(setup);
    }),
  );
  renderSetupRoute(editPath);
  await screen.findByLabelText("Title");
  setupControl("Rear differential model");
  expect(
    screen.getByText("Manufacturer: Historical manufacturer"),
  ).toBeVisible();
  expect(setupControl("Rear differential type")).toHaveValue("lsd");
  expect(setupControl("Rear differential model")).toHaveValue("Rear diff");
  expect(setupControl("Rear differential tuning notes")).toHaveValue(
    "Spring preload\nTwo gears",
  );
  fill("Title", "Unrelated title");
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(received?.data).toEqual(setup.data);
  expect(received).not.toHaveProperty("chassis_model_id");
  expect(received).not.toHaveProperty("rear_differential_manufacturer");
  expect(catalogCalls).toBe(0);
});

it("retries catalog failure, retains historical selection, and cancels manufacturer changes without losing other edits", async () => {
  detail();
  let requests = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
      ++requests === 1
        ? HttpResponse.json({ error: "Private server detail" }, { status: 500 })
        : HttpResponse.json([{ id: activeBrand, name: "MST" }]),
    ),
  );
  renderSetupRoute(editPath);
  await screen.findByLabelText("Title");
  setupControl("Rear differential model");
  fill("Rear differential model", "Unsaved model");
  const user = userEvent.setup();
  await user.click(setupButton({ name: "Change differential manufacturer" }));
  expect(await screen.findByText(/Unable to load manufacturers/)).toBeVisible();
  expect(screen.queryByText("Private server detail")).not.toBeInTheDocument();
  expect(setupControl("Rear differential manufacturer")).toHaveValue(
    testSetup.chassis.brand_id,
  );
  await user.click(setupButton({ name: "Retry differential manufacturers" }));
  const selector = setupControl("Rear differential manufacturer");
  await within(selector).findByRole("option", { name: "MST" });
  await user.selectOptions(selector, activeBrand);
  await user.click(setupButton({ name: "Cancel manufacturer change" }));
  expect(
    screen.getByText("Manufacturer: Historical manufacturer"),
  ).toBeVisible();
  expect(setupControl("Rear differential model")).toHaveValue("Unsaved model");
  expect(requests).toBe(2);
});

it("clears differential fields, then cancels a new manufacturer choice without restoring cleared values", async () => {
  detail();
  mockActiveCatalog();
  let received: Schemas["PatchSetup"] | undefined;
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      received = (await request.json()) as Schemas["PatchSetup"];
      return HttpResponse.json(testSetup);
    }),
  );
  renderSetupRoute(editPath);
  await screen.findByLabelText("Title");
  setupControl("Rear differential model");
  const user = userEvent.setup();
  await user.click(setupButton({ name: "Clear rear differential" }));
  await user.click(setupButton({ name: "Change differential manufacturer" }));
  const selector = setupControl("Rear differential manufacturer");
  await within(selector).findByRole("option", { name: "MST" });
  await user.selectOptions(selector, activeBrand);
  await user.click(setupButton({ name: "Cancel manufacturer change" }));
  expect(screen.getByText("Manufacturer: Not specified")).toBeVisible();
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(received?.data).toEqual(testSetup.data);
});

it("associates errors, focuses invalid model, blocks writes and clears errors on removal", async () => {
  detail();
  let writes = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, () => {
      writes++;
      return HttpResponse.json(testSetup);
    }),
  );
  renderSetupRoute(editPath);
  await screen.findByLabelText("Title");
  setupControl("Rear differential model");
  fill("Rear differential model", "界".repeat(201));
  const user = userEvent.setup();
  await user.click(setupButton({ name: "Save setup" }));
  const model = setupControl("Rear differential model");
  await waitFor(() => expect(model).toHaveFocus());
  expect(model).toHaveAttribute("aria-invalid", "true");
  expect(model).toHaveAccessibleDescription("Use at most 200 characters.");
  expect(writes).toBe(0);
  await user.click(setupButton({ name: "Clear rear differential" }));
  expect(model).not.toBeInTheDocument();
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(writes).toBe(1);
});

it("renders escaped, multiline, historical read-only detail for a non-owner without catalog or mutation controls", async () => {
  const foreign = {
    ...setup,
    owner_id: activeBrand,
    data: {
      ...setup.data,
      rear_differential: {
        ...setup.data.rear_differential,
        tuning_notes: "<script>alert(1)</script>\nTwo gears",
      },
    },
  };
  detail(foreign);
  server.use(
    http.get(`${apiUrl}/api/v1/users/${activeBrand}`, () =>
      HttpResponse.json({
        id: activeBrand,
        nickname: "Other",
        avatar_url: null,
      }),
    ),
  );
  renderSetupRoute(`/setups/${setup.id}`);
  const section = (
    await screen.findByRole("heading", { name: "Rear differential" })
  ).closest("section")!;
  expect(within(section).getByText("LSD")).toBeVisible();
  expect(within(section).getByText("Historical manufacturer")).toBeVisible();
  expect(within(section).getByText(/<script>alert/)).toHaveClass(
    "whitespace-pre-wrap",
  );
  expect(document.querySelector("script")).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Rear differential model"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Clear rear differential" }),
  ).not.toBeInTheDocument();
});

it.each([null, {}])(
  "renders legacy empty differential detail without placeholder values (%j)",
  async (rear_differential) => {
    detail({ ...testSetup, data: { rear_differential } });
    server.use(
      http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
        HttpResponse.json({
          id: testUser.id,
          nickname: testUser.nickname,
          avatar_url: null,
        }),
      ),
    );
    renderSetupRoute(`/setups/${setup.id}`);
    expect(
      await screen.findByText("No technical setup data yet."),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Rear differential" }),
    ).not.toBeInTheDocument();
  },
);
