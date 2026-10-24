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
import { mockActiveCatalog, renderSetupRoute } from "./testUtils";

type Schemas = components["schemas"];
const hardware = {
  piston: {
    holes: 6,
    hole_diameter_mm: 1.23456789,
    notes: "<script>text</script>\nTwo stages",
  },
  seal: { type: "x-ring" as const, description: "Product" },
};
const setup: Schemas["Setup"] = {
  ...testSetup,
  data: {
    ...testSetup.data,
    shocks: {
      front: { ...testSetup.data.shocks?.front, ...hardware },
      rear: { ...testSetup.data.shocks?.rear, ...hardware },
    },
  },
};
const fill = (label: string, value: string) =>
  fireEvent.change(setupControl(label), { target: { value } });
function serve(value = setup) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      HttpResponse.json(value),
    ),
  );
}
it("creates both axles with optional decimal hardware through the credentialed API", async () => {
  mockActiveCatalog();
  let body: Schemas["CreateSetup"] | undefined;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      body = (await request.json()) as Schemas["CreateSetup"];
      return HttpResponse.json(setup, { status: 201 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([setup])),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  fill("Title", "Hardware");
  const user = userEvent.setup();
  for (const axle of ["Front", "Rear"]) {
    fill(`${axle} piston hole count`, "6");
    fill(`${axle} piston hole diameter (mm)`, "1,23456789");
    fill(`${axle} piston notes`, hardware.piston.notes);
    fill(`${axle} seal description`, " Product ");
    await user.selectOptions(setupControl(`${axle} seal type`), "x-ring");
  }
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(body?.data).toEqual({ shocks: { front: hardware, rear: hardware } });
});
it("hydrates both axles and preserves complete data on a title-only PATCH", async () => {
  serve();
  let body: Schemas["PatchSetup"] | undefined;
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      body = (await request.json()) as Schemas["PatchSetup"];
      return HttpResponse.json(setup);
    }),
  );
  renderSetupRoute(`/my/setups/${setup.id}/edit`);
  await screen.findByLabelText("Title");
  for (const axle of ["Front", "Rear"]) {
    expect(setupControl(`${axle} piston hole diameter (mm)`)).toHaveValue(
      "1.23456789",
    );
    expect(setupControl(`${axle} seal type`)).toHaveValue("x-ring");
  }
  fill("Title", "Title only");
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(body?.data).toEqual(setup.data);
  expect(body).not.toHaveProperty("chassis_model_id");
});
it("blocks invalid writes with associated focus, clears hardware, and re-adds partial fields", async () => {
  serve();
  let body: Schemas["PatchSetup"] | undefined;
  let writes = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      writes++;
      body = (await request.json()) as Schemas["PatchSetup"];
      return HttpResponse.json({ ...setup, data: body.data });
    }),
  );
  renderSetupRoute(`/my/setups/${setup.id}/edit`);
  await screen.findByLabelText("Title");
  const user = userEvent.setup();
  fill("Front piston hole count", "1.5");
  await user.click(setupButton({ name: "Save setup" }));
  await waitFor(() =>
    expect(setupControl("Front piston hole count")).toHaveFocus(),
  );
  expect(setupControl("Front piston hole count")).toHaveAccessibleDescription(
    "Enter a whole hole count from 1 to 2147483647.",
  );
  expect(writes).toBe(0);
  for (const axle of ["front", "rear"])
    for (const block of ["piston", "seal"])
      await user.click(setupButton({ name: `Clear ${axle} ${block}` }));
  expect(setupControl("Front piston hole count")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(body?.data).toEqual(testSetup.data);
  fill("Rear seal description", "Description only");
  fill("Front piston notes", "Notes only");
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByDisplayValue("Description only");
  expect(body?.data?.shocks?.front?.piston).toEqual({ notes: "Notes only" });
  expect(body?.data?.shocks?.rear?.seal).toEqual({
    description: "Description only",
  });
});
it("renders escaped multiline detail for both axles without editable controls", async () => {
  serve();
  server.use(
    http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
      HttpResponse.json({
        id: testUser.id,
        nickname: "Owner",
        avatar_url: null,
      }),
    ),
  );
  renderSetupRoute(`/setups/${setup.id}`);
  for (const axle of ["Front", "Rear"]) {
    const section = (
      await screen.findByRole("heading", { name: `${axle} shocks` })
    ).closest("section")!;
    expect(within(section).getByText("1.23456789")).toBeVisible();
    expect(within(section).getByText("X-ring")).toBeVisible();
    expect(within(section).getByText(/<script>text/)).toHaveClass(
      "whitespace-pre-wrap",
    );
  }
  expect(document.querySelector("script")).toBeNull();
  expect(
    screen.queryByLabelText("Front piston hole count"),
  ).not.toBeInTheDocument();
});
it("edits legacy setups with blank hardware without inventing defaults", async () => {
  serve(testSetup);
  renderSetupRoute(`/my/setups/${setup.id}/edit`);
  await screen.findByLabelText("Title");
  expect(setupControl("Front piston hole count")).toHaveValue("");
  expect(setupControl("Rear seal type")).toHaveValue("");
});
