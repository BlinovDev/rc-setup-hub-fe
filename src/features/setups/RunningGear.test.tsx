import { setupControl, setupButton, setupGroup } from "./form/testDriver";
import type { components } from "../../api/generated/schema";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { activeBrand, mockActiveCatalog, renderSetupRoute } from "./testUtils";
type Schemas = components["schemas"];
const id = testSetup.chassis.brand_id;
const setup: Schemas["Setup"] = {
  ...testSetup,
  running_gear_manufacturers: {
    front: {
      wheel: { id, name: "Historical wheel" },
      tire: { id: activeBrand, name: "Historical tire" },
    },
    rear: {
      wheel: { id: activeBrand, name: "Rear wheel brand" },
      tire: { id, name: "Rear tire brand" },
    },
  },
  data: {
    ...testSetup.data,
    front_steering_knuckle: { description: "Existing knuckle" },
    rear_differential: { type: "lsd", tuning_notes: "Diff\nNotes" },
    running_gear: {
      front: {
        hex: { offset_mm: 0 },
        wheel: { manufacturer_id: id, model: "Front wheel", offset_mm: -4 },
        tire: { manufacturer_id: activeBrand, model: "Front tire" },
      },
      rear: {
        hex: { offset_mm: -2.123456789 },
        wheel: { manufacturer_id: activeBrand, offset_mm: 0 },
        tire: { manufacturer_id: id, model: "Rear tire" },
      },
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
it("creates separate hex/wheel/tire fields on both axles with one shared credentialed catalogue", async () => {
  mockActiveCatalog();
  let received: Schemas["CreateSetup"] | undefined,
    calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, ({ request }) => {
      calls++;
      expect(request.credentials).toBe("include");
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
  setupControl("Front wheel model");
  fill("Title", "Running gear");
  const user = userEvent.setup();
  for (const side of ["Front", "Rear"]) {
    fill(`${side} hex offset (mm)`, side === "Front" ? "0" : "-2,123456789");
    fill(`${side} wheel offset (mm)`, side === "Front" ? "-4" : "0");
    for (const part of ["wheel", "tire"]) {
      const selector = setupControl(`${side} ${part} manufacturer`);
      await within(selector).findByRole("option", { name: "MST" });
      await user.selectOptions(selector, activeBrand);
      fill(`${side} ${part} model`, ` ${side} ${part} `);
    }
  }
  fill("Notes", "Free text\nKeep notes");
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(received?.data?.running_gear).toEqual({
    front: {
      hex: { offset_mm: 0 },
      wheel: {
        manufacturer_id: activeBrand,
        model: "Front wheel",
        offset_mm: -4,
      },
      tire: { manufacturer_id: activeBrand, model: "Front tire" },
    },
    rear: {
      hex: { offset_mm: -2.123456789 },
      wheel: {
        manufacturer_id: activeBrand,
        model: "Rear wheel",
        offset_mm: 0,
      },
      tire: { manufacturer_id: activeBrand, model: "Rear tire" },
    },
  });
  expect(received?.notes).toBe("Free text\nKeep notes");
  expect(received).not.toHaveProperty("running_gear_manufacturers");
  expect(calls).toBe(1);
});
it("hydrates historical fields and saves full data on a title-only edit without catalogue requests", async () => {
  serve();
  let received: Schemas["PatchSetup"] | undefined,
    calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
      calls++;
      return HttpResponse.json([]);
    }),
    http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
      received = (await request.json()) as Schemas["PatchSetup"];
      return HttpResponse.json(setup);
    }),
  );
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front wheel model");
  expect(
    screen.getByText("Front wheel manufacturer: Historical wheel"),
  ).toBeVisible();
  setupControl("Rear tire model");
  expect(
    screen.getByText("Rear tire manufacturer: Rear tire brand"),
  ).toBeVisible();
  expect(setupControl("Front hex offset (mm)")).toHaveValue("0");
  expect(setupControl("Rear hex offset (mm)")).toHaveValue("-2.123456789");
  expect(setupControl("Rear wheel offset (mm)")).toHaveValue("0");
  fill("Title", "Changed");
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(received?.data).toEqual(setup.data);
  expect(received).not.toHaveProperty("running_gear_manufacturers");
  expect(received).not.toHaveProperty("chassis_model_id");
  expect(calls).toBe(0);
});
for (const side of ["front", "rear"] as const) {
  const label = side === "front" ? "Front" : "Rear";
  it(`${side} validates without writes, clears only each component and re-adds partial values`, async () => {
    let current = structuredClone(setup);
    let received: Schemas["PatchSetup"] | undefined,
      writes = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
        HttpResponse.json(current),
      ),
      http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
        writes++;
        received = (await request.json()) as Schemas["PatchSetup"];
        current = {
          ...current,
          ...received,
          data: received.data ?? current.data,
        };
        return HttpResponse.json(current);
      }),
    );
    renderSetupRoute(path);
    await screen.findByLabelText("Title");
    setupControl("Front wheel model");
    const user = userEvent.setup();
    fill(`${label} wheel offset (mm)`, "1.5");
    await user.click(setupButton({ name: "Save setup" }));
    const input = setupControl(`${label} wheel offset (mm)`);
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby")!),
    ).toHaveTextContent("whole millimetres");
    expect(writes).toBe(0);
    await user.click(setupButton({ name: `Clear ${side} wheel` }));
    await user.click(setupButton({ name: `Clear ${side} hex` }));
    await user.click(setupButton({ name: `Clear ${side} tire` }));
    await user.click(setupButton({ name: "Save setup" }));
    await screen.findByText("Setup saved.");
    const expected = structuredClone(setup.data);
    delete expected.running_gear?.[side];
    expect(received?.data).toEqual(expected);
    fill(`${label} tire model`, "Model only");
    fill(`${label} hex offset (mm)`, "-3,5");
    await user.click(setupButton({ name: "Save setup" }));
    await waitFor(() => expect(writes).toBe(2));
    expect(received?.data?.running_gear?.[side]).toEqual({
      hex: { offset_mm: -3.5 },
      tire: { model: "Model only" },
    });
  });
  for (const part of ["wheel", "tire"] as const) {
    it(`${side} ${part} catalog failure retains historical reference, retries and cancels`, async () => {
      serve();
      let calls = 0;
      server.use(
        http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
          calls++;
          return calls === 1
            ? HttpResponse.json(
                { error: "private internal detail" },
                { status: 500 },
              )
            : HttpResponse.json([{ id: activeBrand, name: "MST" }]);
        }),
      );
      renderSetupRoute(path);
      await screen.findByLabelText("Title");
      setupControl("Front wheel model");
      const group = setupGroup({
        name: `${label} ${part}`,
      });
      const user = userEvent.setup();
      await user.click(
        within(group).getByRole("button", {
          name: `Change ${side} ${part} manufacturer`,
        }),
      );
      await within(group).findByText(
        "Unable to load manufacturers. Your selection is retained.",
      );
      expect(
        within(group).getByLabelText(`${label} ${part} manufacturer`),
      ).toHaveValue(setup.data.running_gear?.[side]?.[part]?.manufacturer_id);
      expect(
        screen.queryByText("private internal detail"),
      ).not.toBeInTheDocument();
      await user.click(
        within(group).getByRole("button", {
          name: `Retry ${side} ${part} manufacturers`,
        }),
      );
      await within(group).findByRole("option", { name: "MST" });
      await user.selectOptions(
        within(group).getByLabelText(`${label} ${part} manufacturer`),
        "",
      );
      await user.click(
        within(group).getByRole("button", {
          name: "Cancel manufacturer change",
        }),
      );
      expect(
        within(group).getByText(new RegExp(`${label} ${part} manufacturer: `)),
      ).not.toHaveTextContent("Not specified");
    });
  }
}
it("detail shows joined historical names and independent offsets including zero without catalogue reads or owner controls for another viewer", async () => {
  serve({ ...setup, owner_id: activeBrand });
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
      calls++;
      return HttpResponse.json([]);
    }),
    http.get(`${apiUrl}/api/v1/users/${activeBrand}`, () =>
      HttpResponse.json({
        id: activeBrand,
        nickname: "Other",
        avatar_url: null,
      }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${setup.id}/photos`, () =>
      HttpResponse.json([]),
    ),
  );
  renderSetupRoute(`/setups/${setup.id}`);
  const heading = await screen.findByRole("heading", { name: "Front hex" });
  expect(heading.parentElement).toHaveTextContent("0");
  expect(
    screen.getByRole("heading", { name: "Front wheel" }).parentElement,
  ).toHaveTextContent("Historical wheel");
  expect(
    screen.getByRole("heading", { name: "Front wheel" }).parentElement,
  ).toHaveTextContent("-4");
  expect(
    screen.getByRole("heading", { name: "Rear hex" }).parentElement,
  ).toHaveTextContent("-2.123456789");
  expect(
    screen.getByRole("heading", { name: "Rear tire" }).parentElement,
  ).toHaveTextContent("Rear tire brand");
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(calls).toBe(0);
});
it("legacy editor keeps new fields blank and unavailable joined names have a safe fallback", async () => {
  serve({
    ...testSetup,
    data: { running_gear: { front: { wheel: { manufacturer_id: id } } } },
  });
  server.use(
    http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
      HttpResponse.json(testUser),
    ),
    http.get(`${apiUrl}/api/v1/setups/${setup.id}/photos`, () =>
      HttpResponse.json([]),
    ),
  );
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front wheel model");
  expect(setupControl("Rear hex offset (mm)")).toHaveValue("");
  expect(
    screen.getByText(
      "Front wheel manufacturer: Saved manufacturer (name unavailable)",
    ),
  ).toBeVisible();
});
