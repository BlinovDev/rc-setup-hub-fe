import { userSetupsKey } from "./queries";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup } from "./testFixtures";
import {
  activeBrand,
  activeModel,
  mockActiveCatalog,
  renderSetupRoute,
} from "./testUtils";
import { detailKey } from "./queries";
const route = `/my/setups/${testSetup.id}/edit`;
function detail() {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(testSetup),
    ),
  );
}
function input(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("initializes every schema-v1 section including zero and missing values without loading active catalog", async () => {
  detail();
  renderSetupRoute(route);
  await screen.findByLabelText("Title");
  expect(screen.getByLabelText("Title")).toHaveValue(testSetup.title);
  expect(screen.getByLabelText("Front toe (degrees)")).toHaveValue("0");
  expect(screen.getByLabelText("Front caster (degrees)")).toHaveValue("");
  expect(screen.getByLabelText("Front link 1 name")).toHaveValue("Upper");
  expect(screen.getByLabelText("Front link 1 length (mm)")).toHaveValue("25");
  expect(screen.getByLabelText("Rear caster (degrees)")).toHaveValue("2");
  expect(screen.getByLabelText("Front shock manufacturer")).toHaveValue(
    "Yokomo",
  );
  expect(screen.getByLabelText("Front shock model")).toHaveValue("Big bore");
  expect(screen.getByLabelText("Front spring manufacturer")).toHaveValue("MST");
  expect(screen.getByLabelText("Front spring color")).toHaveValue("Red");
  expect(screen.getByLabelText("Front shock oil (cSt)")).toHaveValue("100");
  expect(screen.getByLabelText("Rear shock model")).toHaveValue("Rear shock");
  for (const label of ["Motor", "ESC", "Servo", "Gyro", "Radio"])
    expect(screen.getByLabelText(label)).not.toHaveValue("");
  expect(screen.getByLabelText("Notes")).toHaveValue("Old note");
  expect(screen.getByLabelText("Visibility")).toHaveValue("friends");
  expect(
    screen.getByText("Current chassis: Historical Yokomo RD2.0"),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Brand")).not.toBeInTheDocument();
});
it("PATCHes the complete technical document, preserves historical chassis by omission, and clears notes", async () => {
  detail();
  let received: unknown;
  const saved = {
    ...testSetup,
    notes: null,
    data: {
      ...testSetup.data,
      suspension: {
        ...testSetup.data.suspension,
        front: { ...testSetup.data.suspension.front, toe_deg: 1 },
      },
    },
  };
  server.use(
    http.patch(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      async ({ request }) => {
        expect(request.credentials).toBe("include");
        received = await request.json();
        return HttpResponse.json(saved);
      },
    ),
  );
  const { client } = renderSetupRoute(route);
  const searchKey = ["setups", "search", { q: "old title" }];
  client.setQueryData(searchKey, "cached search");
  client.setQueryData(userSetupsKey(testSetup.owner_id), [testSetup]);
  client.setQueryData(userSetupsKey("another-owner"), []);
  client.setQueryData(["unrelated"], "keep");
  await screen.findByLabelText("Title");
  input("Front toe (degrees)", "1");
  input("Notes", "");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(received).toEqual({
    title: testSetup.title,
    visibility: testSetup.visibility,
    notes: null,
    data: saved.data,
  });
  expect(received).not.toHaveProperty("chassis_model_id");
  expect(received).not.toHaveProperty("owner_id");
  expect(received).not.toHaveProperty("schema_version");
  expect(client.getQueryData(detailKey(testSetup.id))).toEqual(saved);
  expect(client.getQueryState(searchKey)?.isInvalidated).toBe(true);
  expect(
    client.getQueryState(userSetupsKey(testSetup.owner_id))?.isInvalidated,
  ).toBe(true);
  expect(
    client.getQueryState(userSetupsKey("another-owner"))?.isInvalidated,
  ).toBe(false);
  expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
});
it.each(["custom", "active", "cancel"])(
  "handles explicit historical chassis change: %s",
  async (change) => {
    detail();
    mockActiveCatalog();
    let received: unknown;
    server.use(
      http.patch(
        `${apiUrl}/api/v1/setups/${testSetup.id}`,
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json(testSetup);
        },
      ),
    );
    renderSetupRoute(route);
    await screen.findByLabelText("Title");
    const events = userEvent.setup();
    await events.click(screen.getByRole("button", { name: "Change chassis" }));
    await screen.findByRole("option", { name: "MST" });
    if (change !== "custom") {
      await events.selectOptions(screen.getByLabelText("Brand"), activeBrand);
      await screen.findByRole("option", { name: "RMX" });
      await events.selectOptions(screen.getByLabelText("Model"), activeModel);
    }
    if (change === "cancel")
      await events.click(
        screen.getByRole("button", { name: "Cancel chassis change" }),
      );
    await events.click(screen.getByRole("button", { name: "Save setup" }));
    await screen.findByText("Setup saved.");
    if (change === "cancel")
      expect(received).not.toHaveProperty("chassis_model_id");
    else
      expect(received).toHaveProperty(
        "chassis_model_id",
        change === "custom" ? null : activeModel,
      );
  },
);
it("preserves user edits on 409, blocks stale retry and reloads only after explicit action", async () => {
  detail();
  let patches = 0,
    reads = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
      reads++;
      return HttpResponse.json({
        ...testSetup,
        title: reads === 1 ? testSetup.title : "New server title",
      });
    }),
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
      patches++;
      return HttpResponse.json({ error: "Internal" }, { status: 409 });
    }),
  );
  renderSetupRoute(route);
  await screen.findByLabelText("Title");
  input("Title", "Unsaved title");
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Save setup" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "changed concurrently",
  );
  expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
  expect(screen.getByRole("button", { name: "Save setup" })).toBeDisabled();
  expect(patches).toBe(1);
  await events.click(
    screen.getByRole("button", {
      name: "Reload setup (discard unsaved changes)",
    }),
  );
  expect(
    await screen.findByDisplayValue("New server title"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save setup" })).toBeEnabled();
  expect(patches).toBe(1);
});
it.each([400, 404])(
  "shows generic unavailable state for GET %s",
  async (status) => {
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json({ error: "Internal" }, { status }),
      ),
    );
    renderSetupRoute(route);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Setup not found or unavailable.",
    );
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  },
);
it("validates route UUID before requesting detail", async () => {
  renderSetupRoute("/my/setups/not-a-uuid/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Setup not found or unavailable.",
  );
});
it("does not render editable controls for a readable non-owned setup", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, owner_id: activeBrand }),
    ),
  );
  renderSetupRoute(route);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete setup" }),
  ).not.toBeInTheDocument();
});
it("does not reinterpret unsupported schema metadata", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, schema_version: 2 }),
    ),
  );
  renderSetupRoute(route);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "version is not supported",
  );
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
it("recovers from detail server failure through explicit retry", async () => {
  let requests = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
      requests++;
      return requests === 1
        ? HttpResponse.json({ error: "Internal" }, { status: 500 })
        : HttpResponse.json(testSetup);
    }),
  );
  renderSetupRoute(route);
  await screen.findByRole("alert");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Retry setup" }));
  await screen.findByLabelText("Title");
  expect(requests).toBe(2);
});
it.each([400, 403, 404, 500])(
  "handles PATCH %s without inventing auth failure",
  async (status) => {
    detail();
    server.use(
      http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json({ error: "Internal" }, { status }),
      ),
    );
    renderSetupRoute(route);
    await screen.findByLabelText("Title");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save setup" }));
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Internal")).not.toBeInTheDocument();
    if (status === 404)
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    else expect(screen.getByLabelText("Title")).toHaveValue(testSetup.title);
  },
);
it.each(["get", "patch"])(
  "transitions existing auth to sign-in for %s 401",
  async (operation) => {
    detail();
    if (operation === "get")
      server.use(
        http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
          HttpResponse.json({ error: "Expired" }, { status: 401 }),
        ),
      );
    else
      server.use(
        http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
          HttpResponse.json({ error: "Expired" }, { status: 401 }),
        ),
      );
    renderSetupRoute(route);
    if (operation === "patch") {
      await screen.findByLabelText("Title");
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Save setup" }));
    }
    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  },
);
it("deletes from edit and navigates back to owned setups", async () => {
  detail();
  server.use(
    http.delete(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  const { router } = renderSetupRoute(route);
  await screen.findByLabelText("Title");
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Delete setup" }));
  await events.click(screen.getByRole("button", { name: "Confirm delete" }));
  await screen.findByText("Setup deleted.");
  expect(router.state.location.pathname).toBe("/my/setups");
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
