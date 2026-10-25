import { setupControl, setupButton } from "./form/testDriver";
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
    http.get(`${apiUrl}/api/v1/users/${testSetup.owner_id}`, () =>
      HttpResponse.json({
        id: testSetup.owner_id,
        nickname: "Driver",
        avatar_url: null,
      }),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(testSetup),
    ),
  );
}
function input(label: string, value: string) {
  fireEvent.change(setupControl(label), { target: { value } });
}
it("initializes every schema-v1 section including zero and missing values without loading active catalog", async () => {
  detail();
  renderSetupRoute(route);
  await screen.findByLabelText("Title");
  expect(setupControl("Title")).toHaveValue(testSetup.title);
  expect(setupControl("Front toe (degrees)")).toHaveValue("0");
  expect(setupControl("Front caster (degrees)")).toHaveValue("");
  expect(setupControl("Front link 1 name")).toHaveValue("Upper");
  expect(setupControl("Front link 1 length (mm)")).toHaveValue("25");
  expect(setupControl("Rear caster (degrees)")).toHaveValue("2");
  expect(setupControl("Front shock manufacturer")).toHaveValue("Yokomo");
  expect(setupControl("Front shock model")).toHaveValue("Big bore");
  expect(setupControl("Front spring manufacturer")).toHaveValue("MST");
  expect(setupControl("Front spring color")).toHaveValue("Red");
  expect(setupControl("Front shock oil (cSt)")).toHaveValue("100");
  expect(setupControl("Rear shock model")).toHaveValue("Rear shock");
  for (const label of ["Motor", "ESC", "Servo", "Gyro", "Radio"])
    expect(setupControl(label)).not.toHaveValue("");
  expect(setupControl("Notes")).toHaveValue("Old note");
  expect(setupControl("Visibility")).toHaveValue("friends");
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
        server.use(
          http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
            HttpResponse.json(saved),
          ),
        );
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
  await userEvent.setup().click(setupButton({ name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
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
    await events.click(setupButton({ name: "Change chassis" }));
    await screen.findByRole("option", { name: "MST" });
    if (change !== "custom") {
      await events.selectOptions(setupControl("Brand"), activeBrand);
      await screen.findByRole("option", { name: "RMX" });
      await events.selectOptions(setupControl("Model"), activeModel);
    }
    if (change === "cancel")
      await events.click(setupButton({ name: "Cancel chassis change" }));
    await events.click(setupButton({ name: "Save setup" }));
    await screen.findByRole("link", { name: "Edit setup" });
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
  input("Front toe (degrees)", "0,5");
  expect(
    screen.queryByRole("button", { name: "Delete setup" }),
  ).not.toBeInTheDocument();
  const events = userEvent.setup();
  await events.click(setupButton({ name: "Save setup" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "changed concurrently",
  );
  expect(setupControl("Title")).toHaveValue("Unsaved title");
  expect(setupButton({ name: "Save setup" })).toBeDisabled();
  expect(patches).toBe(1);
  await events.click(
    setupButton({
      name: "Reload setup (discard unsaved changes)",
    }),
  );
  expect(
    await screen.findByDisplayValue("New server title"),
  ).toBeInTheDocument();
  expect(setupButton({ name: "Save setup" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Delete setup" })).toBeVisible();
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
  let writes = 0,
    galleries = 0;
  server.use(
    http.all(`${apiUrl}/api/v1/setups/${testSetup.id}/*`, ({ request }) => {
      if (request.method !== "GET") writes++;
      else galleries++;
      return HttpResponse.json([]);
    }),
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
      writes++;
      return HttpResponse.json(testSetup);
    }),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, owner_id: activeBrand }),
    ),
  );
  renderSetupRoute(route);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Setup not found or unavailable.",
  );
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete setup" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Manage setup photos" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Choose photos" }),
  ).not.toBeInTheDocument();
  expect(galleries).toBe(0);
  expect(writes).toBe(0);
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
  await userEvent.setup().click(setupButton({ name: "Retry setup" }));
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
    await userEvent.setup().click(setupButton({ name: "Save setup" }));
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Internal")).not.toBeInTheDocument();
    if (status === 404)
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    else expect(setupControl("Title")).toHaveValue(testSetup.title);
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
      await userEvent.setup().click(setupButton({ name: "Save setup" }));
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
  await events.click(setupButton({ name: "Delete setup" }));
  await events.click(setupButton({ name: "Confirm delete" }));
  await screen.findByText("Setup deleted.");
  expect(router.state.location.pathname).toBe("/my/setups");
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
it("keeps whole-setup deletion only in General and offers no section-wide clear", async () => {
  detail();
  renderSetupRoute(route);
  await screen.findByLabelText("Title");
  expect(screen.getByRole("button", { name: "Delete setup" })).toBeVisible();
  setupControl("Front toe (degrees)");
  expect(
    screen.queryByRole("button", { name: "Delete setup" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /clear current section/i }),
  ).not.toBeInTheDocument();
  setupControl("Title");
  expect(screen.getByRole("button", { name: "Delete setup" })).toBeVisible();
});
it("replaces a successful section editor in history; Back returns to the prior overview without stale draft", async () => {
  detail();
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, async ({ request }) =>
      HttpResponse.json({
        ...testSetup,
        ...((await request.json()) as object),
      }),
    ),
  );
  const { router } = renderSetupRoute(`/setups/${testSetup.id}`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("link", { name: "Edit setup" }));
  input("Front toe (degrees)", "0,123456789");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await screen.findByRole("link", { name: "Edit setup" });
  expect(router.state.location.pathname).toBe(`/setups/${testSetup.id}`);
  expect(router.state.historyAction).toBe("REPLACE");
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  await import("@testing-library/react").then(({ act }) =>
    act(() => router.navigate(-1)),
  );
  expect(router.state.location.pathname).toBe(`/setups/${testSetup.id}`);
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
it("does not discard queued original photo bytes when setup Save succeeds", async () => {
  detail();
  server.use(
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(testSetup),
    ),
  );
  const { router } = renderSetupRoute(route);
  await screen.findByLabelText("Title");
  const file = new File(["original HEIF bytes"], "iphone.heic", {
    type: "image/heic",
  });
  fireEvent.change(screen.getByLabelText("Photo files"), {
    target: { files: [file] },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await screen.findByRole("dialog", { name: "Leave unsaved changes?" });
  expect(router.state.location.pathname).toBe(route);
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByText("iphone.heic")).toBeVisible();
  expect(screen.getByLabelText("Title")).toHaveValue(testSetup.title);
  await user.click(screen.getByRole("link", { name: "Back to my setups" }));
  await screen.findByRole("dialog", { name: "Leave unsaved changes?" });
});
