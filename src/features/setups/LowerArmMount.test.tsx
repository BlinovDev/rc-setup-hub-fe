import { setupControl, setupButton, setupGroup } from "./form/testDriver";
import type { components } from "../../api/generated/schema";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { activeBrand, mockActiveCatalog, renderSetupRoute } from "./testUtils";
type Schemas = components["schemas"];
const mounts = {
  front: {
    manufacturer_id: testSetup.chassis.brand_id,
    model: "Front part",
    configuration_notes: "Front inserts\nMount B",
  },
  rear: {
    manufacturer_id: activeBrand,
    model: "Rear part",
    configuration_notes: "Rear config",
  },
};
const setup: Schemas["Setup"] = {
  ...testSetup,
  lower_arm_mount_manufacturers: {
    front: { id: testSetup.chassis.brand_id, name: "Historical front brand" },
    rear: { id: activeBrand, name: "Historical rear brand" },
  },
  data: {
    ...testSetup.data,
    front_steering_knuckle: { description: "Existing knuckle" },
    suspension: {
      front: {
        ...testSetup.data.suspension?.front,
        lower_arm_mount: mounts.front,
      },
      rear: {
        ...testSetup.data.suspension?.rear,
        lower_arm_mount: mounts.rear,
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
it("creates both optional mounts through the shared credentialed client and one cached catalog query", async () => {
  mockActiveCatalog();
  let received: Schemas["CreateSetup"] | undefined;
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, ({ request }) => {
      expect(request.credentials).toBe("include");
      calls++;
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
  setupControl("Front lower arm mount model / part number");
  fill("Title", "Mounts");
  const user = userEvent.setup();
  for (const side of ["Front", "Rear"]) {
    const selector = setupControl(`${side} lower arm mount manufacturer`);
    await within(selector).findByRole("option", { name: "MST" });
    await user.selectOptions(selector, activeBrand);
    fill(`${side} lower arm mount model / part number`, ` ${side} part `);
    fill(
      `${side} lower arm mount configuration notes`,
      ` ${side} inserts\nMount B `,
    );
  }
  fill("Front toe (degrees)", "0");
  fill("Rear camber (degrees)", "-1,25");
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(received).toMatchObject({
    chassis_model_id: null,
    data: {
      suspension: {
        front: {
          toe_deg: 0,
          lower_arm_mount: {
            manufacturer_id: activeBrand,
            model: "Front part",
            configuration_notes: "Front inserts\nMount B",
          },
        },
        rear: {
          camber_deg: -1.25,
          lower_arm_mount: {
            manufacturer_id: activeBrand,
            model: "Rear part",
            configuration_notes: "Rear inserts\nMount B",
          },
        },
      },
    },
  });
  expect(calls).toBe(1);
});
it("hydrates historical names for both axles and preserves complete data on unrelated edits without catalog requests", async () => {
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
  setupControl("Front lower arm mount model / part number");
  for (const side of ["Front", "Rear"]) {
    setupControl(`${side} lower arm mount model / part number`);
    expect(
      screen.getByText(
        `${side} lower arm mount manufacturer: Historical ${side.toLowerCase()} brand`,
      ),
    ).toBeVisible();
    expect(
      setupControl(`${side} lower arm mount model / part number`),
    ).toHaveValue(`${side} part`);
  }
  fill("Title", "Title only");
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(received?.data).toEqual(setup.data);
  expect(received).not.toHaveProperty("lower_arm_mount_manufacturers");
  expect(received).not.toHaveProperty("chassis_model_id");
  expect(calls).toBe(0);
});
for (const side of ["front", "rear"] as const) {
  const label = side === "front" ? "Front" : "Rear";
  it(`${side} retries catalog failure and cancels changes without losing sibling drafts`, async () => {
    serve();
    let calls = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/chassis/brands`, () =>
        ++calls === 1
          ? HttpResponse.json(
              { error: "Private server detail" },
              { status: 500 },
            )
          : HttpResponse.json([{ id: activeBrand, name: "MST" }]),
      ),
    );
    renderSetupRoute(path);
    await screen.findByLabelText("Title");
    setupControl("Front lower arm mount model / part number");
    fill(
      `${label} lower arm mount configuration notes`,
      "Unsaved mount config",
    );
    const user = userEvent.setup();
    const group = setupGroup({ name: `${label} lower arm mount` });
    await user.click(
      within(group).getByRole("button", {
        name: `Change ${side} lower arm mount manufacturer`,
      }),
    );
    expect(
      await within(group).findByText(/Unable to load manufacturers/),
    ).toBeVisible();
    expect(screen.queryByText("Private server detail")).not.toBeInTheDocument();
    expect(setupControl(`${label} lower arm mount manufacturer`)).toHaveValue(
      mounts[side].manufacturer_id,
    );
    await user.click(
      within(group).getByRole("button", {
        name: `Retry ${side} lower arm mount manufacturers`,
      }),
    );
    const selector = setupControl(`${label} lower arm mount manufacturer`);
    await within(selector).findByRole("option", { name: "MST" });
    await user.selectOptions(selector, "");
    await user.click(
      within(group).getByRole("button", { name: "Cancel manufacturer change" }),
    );
    expect(
      within(group).getByText(
        `${label} lower arm mount manufacturer: Historical ${side} brand`,
      ),
    ).toBeVisible();
    expect(
      setupControl(`${label} lower arm mount configuration notes`),
    ).toHaveValue("Unsaved mount config");
    expect(calls).toBe(2);
  });
  it(`${side} clear then cancel a new manufacturer choice does not restore the removed mount`, async () => {
    serve();
    mockActiveCatalog();
    let received: Schemas["PatchSetup"] | undefined;
    server.use(
      http.patch(`${apiUrl}/api/v1/setups/${setup.id}`, async ({ request }) => {
        received = (await request.json()) as Schemas["PatchSetup"];
        server.use(
          http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
            HttpResponse.json({ ...setup, ...received }),
          ),
        );
        return HttpResponse.json({ ...setup, data: received.data });
      }),
    );
    renderSetupRoute(path);
    await screen.findByLabelText("Title");
    setupControl("Front lower arm mount model / part number");
    const user = userEvent.setup();
    setupGroup({ name: `${label} lower arm mount` });
    await user.click(setupButton({ name: `Clear ${side} lower arm mount` }));
    const group = setupGroup({ name: `${label} lower arm mount` });
    await user.click(
      within(group).getByRole("button", {
        name: `Change ${side} lower arm mount manufacturer`,
      }),
    );
    const selector = setupControl(`${label} lower arm mount manufacturer`);
    await within(selector).findByRole("option", { name: "MST" });
    await user.selectOptions(selector, activeBrand);
    await user.click(
      within(group).getByRole("button", { name: "Cancel manufacturer change" }),
    );
    expect(
      within(group).getByText(
        `${label} lower arm mount manufacturer: Not specified`,
      ),
    ).toBeVisible();
    await user.click(setupButton({ name: "Save setup" }));
    await screen.findByRole("link", { name: "Edit setup" });
    const expected = structuredClone(setup.data);
    delete expected.suspension?.[side]?.lower_arm_mount;
    expect(received?.data).toEqual(expected);
  });
  it(`${side} associates validation/focus and clears only the selected mount`, async () => {
    serve();
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
        return HttpResponse.json({ ...setup, data: received.data });
      }),
    );
    renderSetupRoute(path);
    await screen.findByLabelText("Title");
    setupControl("Front lower arm mount model / part number");
    const user = userEvent.setup();
    setupGroup({
      name: `${label} lower arm mount`,
    });
    fill(`${label} lower arm mount model / part number`, "界".repeat(201));
    await user.click(setupButton({ name: "Save setup" }));
    const model = setupControl(`${label} lower arm mount model / part number`);
    await waitFor(() => expect(model).toHaveFocus());
    expect(model).toHaveAccessibleDescription("Use at most 200 characters.");
    expect(writes).toBe(0);
    await user.click(setupButton({ name: `Clear ${side} lower arm mount` }));
    expect(model).toBeVisible();
    expect(model).toHaveValue("");
    await user.click(setupButton({ name: "Save setup" }));
    await screen.findByRole("link", { name: "Edit setup" });
    const expected = structuredClone(setup.data);
    delete expected.suspension?.[side]?.lower_arm_mount;
    expect(received?.data).toEqual(expected);
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    fill(`${label} lower arm mount configuration notes`, "Notes only\nMount B");
    await user.click(setupButton({ name: "Save setup" }));
    await waitFor(() =>
      expect(received?.data?.suspension?.[side]?.lower_arm_mount).toEqual({
        configuration_notes: "Notes only\nMount B",
      }),
    );
  });
}
it("shows escaped multiline, historical read-only detail for both axles to a non-owner without catalog lookups", async () => {
  serve({
    ...setup,
    owner_id: activeBrand,
    data: {
      ...setup.data,
      suspension: {
        front: {
          lower_arm_mount: {
            ...mounts.front,
            configuration_notes: "<script>text</script>\nFront config",
          },
        },
        rear: { lower_arm_mount: mounts.rear },
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
  for (const label of ["Front", "Rear"]) {
    const section = (
      await screen.findByRole("heading", {
        name: `${label} lower arm mount`,
      })
    ).closest("section")!;
    expect(
      within(section).getByText(`Historical ${label.toLowerCase()} brand`),
    ).toBeVisible();
    expect(within(section).getByText(`${label} part`)).toBeVisible();
  }
  expect(screen.getByText(/<script>text/)).toHaveClass("whitespace-pre-wrap");
  expect(document.querySelector("script")).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Front lower arm mount model / part number"),
  ).not.toBeInTheDocument();
});
it("edits legacy setups with blank optional mount controls", async () => {
  serve(testSetup);
  renderSetupRoute(path);
  await screen.findByLabelText("Title");
  setupControl("Front lower arm mount model / part number");
  for (const label of ["Front", "Rear"]) {
    expect(
      setupControl(`${label} lower arm mount model / part number`),
    ).toHaveValue("");
    expect(
      screen.getByText(`${label} lower arm mount manufacturer: Not specified`),
    ).toBeVisible();
  }
});
it.each([null, {}])(
  "omits empty mount detail sections: %j",
  async (lower_arm_mount) => {
    serve({
      ...testSetup,
      data: {
        suspension: { front: { lower_arm_mount }, rear: { lower_arm_mount } },
      },
    });
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
      screen.queryByRole("heading", { name: "Front lower arm mount" }),
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
