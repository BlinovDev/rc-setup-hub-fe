import { waitFor } from "@testing-library/react";
import { setupControl, setupButton } from "./form/testDriver";
import type { components } from "../../api/generated/schema";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { activeBrand, mockActiveCatalog, renderSetupRoute } from "./testUtils";
type Schemas = components["schemas"];
const setup: Schemas["Setup"] = {
  ...testSetup,
  front_steering_knuckle_manufacturer: {
    id: testSetup.chassis.brand_id,
    name: "Historical knuckle brand",
  },
  data: {
    ...testSetup.data,
    front_steering_knuckle: {
      manufacturer_id: testSetup.chassis.brand_id,
      description: "Part #42\nAluminum",
    },
  },
};
const path = `/my/setups/${setup.id}/edit`;
const fill = (label: string, value: string) =>
  fireEvent.change(setupControl(label), { target: { value } });
function serve(value = setup) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      HttpResponse.json(value),
    ),
  );
}
it("creates an independent front knuckle and shares the existing credentialed brand query", async () => {
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
  setupControl("Front knuckle part number / description");
  fill("Title", "Knuckle");
  const user = userEvent.setup();
  const selector = setupControl("Front knuckle manufacturer");
  await within(selector).findByRole("option", { name: "MST" });
  await user.selectOptions(selector, activeBrand);
  fill("Front knuckle part number / description", " Part #42\nAluminum ");
  fill("Front toe (degrees)", "0");
  fill("Rear camber (degrees)", "-1,25");
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(received).toMatchObject({
    chassis_model_id: null,
    data: {
      front_steering_knuckle: {
        manufacturer_id: activeBrand,
        description: "Part #42\nAluminum",
      },
      suspension: { front: { toe_deg: 0 }, rear: { camber_deg: -1.25 } },
    },
  });
  expect(catalogCalls).toBe(1);
  expect(received?.data).not.toHaveProperty("rear_steering_knuckle");
});
it("retains historical selection and complete data on unrelated edits without catalog lookups", async () => {
  serve();
  let received: Schemas["PatchSetup"] | undefined;
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
      calls++;
      return HttpResponse.json([]);
    }),
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      received = (await request.json()) as Schemas["PatchSetup"];
      server.use(
        http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
          HttpResponse.json({ ...setup, ...received }),
        ),
      );
      return HttpResponse.json(setup);
    }),
  );
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front knuckle part number / description");
  expect(
    screen.getByText("Front knuckle manufacturer: Historical knuckle brand"),
  ).toBeVisible();
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "Part #42\nAluminum",
  );
  fill("Title", "Title only");
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(received?.data).toEqual(setup.data);
  expect(received).not.toHaveProperty("chassis_model_id");
  expect(received).not.toHaveProperty("front_steering_knuckle_manufacturer");
  expect(calls).toBe(0);
});
it("retries catalog failures and cancels changed manufacturer without discarding description edits", async () => {
  serve();
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
      ++calls === 1
        ? HttpResponse.json({ error: "Private server detail" }, { status: 500 })
        : HttpResponse.json([{ id: activeBrand, name: "MST" }]),
    ),
  );
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front knuckle part number / description");
  fill("Front knuckle part number / description", "Unsaved part");
  const user = userEvent.setup();
  await user.click(setupButton({ name: "Change knuckle manufacturer" }));
  expect(await screen.findByText(/Unable to load manufacturers/)).toBeVisible();
  expect(screen.queryByText("Private server detail")).not.toBeInTheDocument();
  expect(setupControl("Front knuckle manufacturer")).toHaveValue(
    testSetup.chassis.brand_id,
  );
  await user.click(setupButton({ name: "Retry knuckle manufacturers" }));
  const selector = setupControl("Front knuckle manufacturer");
  await within(selector).findByRole("option", { name: "MST" });
  await user.selectOptions(selector, activeBrand);
  await user.click(setupButton({ name: "Cancel manufacturer change" }));
  expect(
    screen.getByText("Front knuckle manufacturer: Historical knuckle brand"),
  ).toBeVisible();
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "Unsaved part",
  );
  expect(calls).toBe(2);
});
it("blocks invalid writes with associated focus and clears/re-adds independent fields", async () => {
  serve();
  mockActiveCatalog();
  let received: Schemas["PatchSetup"] | undefined;
  let writes = 0;
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      writes++;
      received = (await request.json()) as Schemas["PatchSetup"];
      server.use(
        http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
          HttpResponse.json({ ...setup, ...received }),
        ),
      );
      return HttpResponse.json({
        ...setup,
        data: received.data,
        front_steering_knuckle_manufacturer: null,
      });
    }),
  );
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front knuckle part number / description");
  fill("Front knuckle part number / description", "界".repeat(201));
  const user = userEvent.setup();
  await user.click(setupButton({ name: "Save setup" }));
  const description = setupControl("Front knuckle part number / description");
  await waitFor(() => expect(description).toHaveFocus());
  expect(description).toHaveAccessibleDescription(
    "Use at most 200 characters.",
  );
  expect(writes).toBe(0);
  await user.click(setupButton({ name: "Clear front knuckle" }));
  expect(description).not.toBeInTheDocument();
  // Clear then cancel a new choice must not restore the historical selection.
  await user.click(setupButton({ name: "Change knuckle manufacturer" }));
  const selector = setupControl("Front knuckle manufacturer");
  await within(selector).findByRole("option", { name: "MST" });
  await user.selectOptions(selector, activeBrand);
  await user.click(setupButton({ name: "Cancel manufacturer change" }));
  expect(
    screen.getByText("Front knuckle manufacturer: Not specified"),
  ).toBeVisible();
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(received?.data).toEqual(testSetup.data);
  await user.click(screen.getByRole("link", { name: "Edit setup" }));
  await screen.findByLabelText("Title");
  fill("Front knuckle part number / description", "Description only");
  await user.click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(received?.data?.front_steering_knuckle).toEqual({
    description: "Description only",
  });
});
it("renders escaped read-only historical detail for a non-owner without catalog requests", async () => {
  serve({
    ...setup,
    owner_id: activeBrand,
    data: {
      ...setup.data,
      front_steering_knuckle: {
        ...setup.data.front_steering_knuckle,
        description: "<script>text</script>\nPart",
      },
    },
  });
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
    await screen.findByRole("heading", { name: "Front steering knuckle" })
  ).closest("section")!;
  expect(within(section).getByText("Historical knuckle brand")).toBeVisible();
  expect(within(section).getByText(/<script>text/)).toHaveClass(
    "whitespace-pre-wrap",
  );
  expect(document.querySelector("script")).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Front knuckle part number / description"),
  ).not.toBeInTheDocument();
});
it("edits legacy setups with blank controls", async () => {
  serve(testSetup);
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front knuckle part number / description");
  expect(setupControl("Front knuckle part number / description")).toHaveValue(
    "",
  );
  expect(
    screen.getByText("Front knuckle manufacturer: Not specified"),
  ).toBeVisible();
});
it.each([null, {}])(
  "omits empty detail sections: %j",
  async (front_steering_knuckle) => {
    serve({ ...testSetup, data: { front_steering_knuckle } });
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
    expect(
      await screen.findByText("No technical setup data yet."),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Front steering knuckle" }),
    ).not.toBeInTheDocument();
  },
);

beforeEach(() => {
  server.use(
    http.get(`${apiUrl}/api/v1/users/${testSetup.owner_id}`, () =>
      HttpResponse.json({
        id: testSetup.owner_id,
        nickname: "Driver",
        avatar_url: null,
      }),
    ),
  );
});
