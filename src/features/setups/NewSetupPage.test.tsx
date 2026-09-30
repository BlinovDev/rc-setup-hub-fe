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

function input(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("creates Custom with numeric zero and omitted blank angles through the existing client", async () => {
  mockActiveCatalog();
  let received: unknown;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      received = await request.json();
      return HttpResponse.json(testSetup, { status: 201 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
  );
  const { router, client } = renderSetupRoute("/my/setups/new");
  const searchKey = ["setups", "search", { q: "" }];
  client.setQueryData(searchKey, "cached search");
  client.setQueryData(["unrelated"], "keep");
  await screen.findByLabelText("Title");
  input("Title", "  Track setup  ");
  input("Front toe (degrees)", "0");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Create setup" }));
  expect(await screen.findByText("Setup created.")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/my/setups");
  expect(client.getQueryState(searchKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
  expect(received).toEqual({
    title: "Track setup",
    visibility: "private",
    notes: null,
    chassis_model_id: null,
    data: { suspension: { front: { toe_deg: 0 } } },
  });
});
it("blocks a selected brand without model and validates required title", async () => {
  mockActiveCatalog();
  let posts = 0;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, () => {
      posts++;
      return HttpResponse.json(testSetup, { status: 201 });
    }),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Create setup" }));
  expect(
    await screen.findByText("This field is required."),
  ).toBeInTheDocument();
  input("Title", "Title");
  await screen.findByRole("option", { name: "MST" });
  await userEvent
    .setup()
    .selectOptions(screen.getByLabelText("Brand"), activeBrand);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Create setup" }));
  expect(
    await screen.findByText("Select a model for the chosen brand."),
  ).toBeInTheDocument();
  expect(posts).toBe(0);
});
it("creates a realistic document with active chassis, links, shocks and electronics", async () => {
  mockActiveCatalog();
  let received: unknown;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      received = await request.json();
      return HttpResponse.json(testSetup, { status: 201 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  input("Title", "  Race  ");
  await screen.findByRole("option", { name: "MST" });
  const events = userEvent.setup();
  await events.selectOptions(screen.getByLabelText("Brand"), activeBrand);
  await screen.findByRole("option", { name: "RMX" });
  await events.selectOptions(screen.getByLabelText("Model"), activeModel);
  await events.selectOptions(screen.getByLabelText("Visibility"), "public");
  input("Notes", " Track note ");
  input("Front camber (degrees)", "-1.5");
  input("Front toe (degrees)", "0");
  input("Rear caster (degrees)", "2");
  await events.click(screen.getByRole("button", { name: "Add front link" }));
  input("Front link 1 name", " Upper ");
  input("Front link 1 length (mm)", "25");
  input("Front shock manufacturer", " Yokomo ");
  input("Front shock model", "Big bore");
  input("Front spring manufacturer", "MST");
  input("Front spring color", "Red");
  input("Front shock oil (cSt)", "100");
  input("Rear shock model", "Rear shock");
  input("Motor", "10.5T");
  input("ESC", "ESC model");
  input("Servo", "Servo");
  input("Gyro", "Gyro");
  input("Radio", "Radio");
  await events.click(screen.getByRole("button", { name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(received).toEqual({
    title: "Race",
    visibility: "public",
    notes: "Track note",
    chassis_model_id: activeModel,
    data: testSetup.data,
  });
});
it("validates independent front/rear link rows and removes empty rows rather than sending placeholders", async () => {
  mockActiveCatalog();
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  input("Title", "Title");
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Add front link" }));
  await events.click(screen.getByRole("button", { name: "Add rear link" }));
  input("Front link 1 name", "Upper");
  input("Front link 1 length (mm)", "0");
  input("Rear link 1 name", "Rear");
  input("Rear link 1 length (mm)", "30");
  await events.click(screen.getByRole("button", { name: "Create setup" }));
  expect(
    await screen.findByText("Enter a finite length greater than zero."),
  ).toBeInTheDocument();
  await events.click(
    screen.getByRole("button", { name: "Remove front link 1" }),
  );
  expect(screen.queryByLabelText("Front link 1 name")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Rear link 1 length (mm)")).toHaveValue("30");
});
it.each([400, 403, 500, 415])(
  "shows safe create %s failure without discarding the form",
  async (status) => {
    mockActiveCatalog();
    server.use(
      http.post(`${apiUrl}/api/v1/setups`, () =>
        HttpResponse.json({ error: "Internal details" }, { status }),
      ),
    );
    renderSetupRoute("/my/setups/new");
    await screen.findByLabelText("Title");
    input("Title", "Title");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create setup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 400
        ? "request was rejected"
        : status === 403
          ? "request is not allowed"
          : "Unable to save setup",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Title");
    expect(screen.queryByText("Internal details")).not.toBeInTheDocument();
  },
);
it("create 401 clears existing authenticated UI", async () => {
  mockActiveCatalog();
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  input("Title", "Title");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Create setup" }));
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});
