import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup } from "./testFixtures";
import { renderSetupRoute } from "./testUtils";
import { detailKey, mineKey } from "./queries";
it("shows loading followed by empty state with a create action", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, async () => {
      await delay(100);
      return HttpResponse.json([]);
    }),
  );
  renderSetupRoute("/my/setups");
  expect(await screen.findByText("Loading setups…")).toBeInTheDocument();
  expect(await screen.findByText("No setups yet.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "New setup" })).toHaveAttribute(
    "href",
    "/my/setups/new",
  );
});
it("shows historical projection and Custom without querying active catalog", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json([
        testSetup,
        {
          ...testSetup,
          id: "c61393b6-daa0-4eb8-923c-57aedbb46a52",
          title: "Custom setup",
          chassis: null,
          chassis_model_id: null,
        },
      ]);
    }),
  );
  renderSetupRoute("/my/setups");
  await screen.findByText(testSetup.title);
  expect(screen.getByText("Historical Yokomo RD2.0")).toBeInTheDocument();
  expect(screen.getByText("Custom / not listed")).toBeInTheDocument();
  expect(screen.getAllByText("Visibility: friends")).toHaveLength(2);
});
it.each(["server", "network"])("retries %s list failure", async (failure) => {
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () => {
      calls++;
      return calls > 1
        ? HttpResponse.json([testSetup])
        : failure === "network"
          ? HttpResponse.error()
          : HttpResponse.json({ error: "Internal" }, { status: 500 });
    }),
  );
  renderSetupRoute("/my/setups");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load setups",
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Retry setups" }));
  await screen.findByText(testSetup.title);
  expect(calls).toBe(2);
});
it("requires delete confirmation, cancel sends nothing, and success refreshes only owned caches", async () => {
  let deleted = false,
    calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json(deleted ? [] : [testSetup]),
    ),
    http.delete(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      async ({ request }) => {
        calls++;
        expect(request.credentials).toBe("include");
        await delay(100);
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );
  const { client } = renderSetupRoute("/my/setups");
  client.setQueryData(detailKey(testSetup.id), testSetup);
  client.setQueryData(["unrelated"], "keep");
  await screen.findByText(testSetup.title);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Delete setup" }));
  expect(calls).toBe(0);
  await events.click(screen.getByRole("button", { name: "Cancel" }));
  expect(calls).toBe(0);
  await events.click(screen.getByRole("button", { name: "Delete setup" }));
  await events.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  await screen.findByText("No setups yet.");
  expect(calls).toBe(1);
  expect(client.getQueryData(detailKey(testSetup.id))).toBeUndefined();
  expect(client.getQueryData(mineKey)).toEqual([]);
  expect(client.getQueryData(["unrelated"])).toBe("keep");
});
it.each([400, 403, 404, 500])(
  "does not pretend delete %s succeeded",
  async (status) => {
    server.use(
      http.get(`${apiUrl}/api/v1/me/setups`, () =>
        HttpResponse.json([testSetup]),
      ),
      http.delete(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json({ error: "Internal" }, { status }),
      ),
    );
    renderSetupRoute("/my/setups");
    await screen.findByText(testSetup.title);
    const events = userEvent.setup();
    await events.click(screen.getByRole("button", { name: "Delete setup" }));
    await events.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 404
        ? "Setup not found or unavailable"
        : status === 400
          ? "request was rejected"
          : status === 403
            ? "request is not allowed"
            : "Unable to delete setup",
    );
    expect(screen.getByText(testSetup.title)).toBeInTheDocument();
    expect(screen.queryByText("No setups yet.")).not.toBeInTheDocument();
  },
);
it("list 401 transitions to the existing unauthenticated experience", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/my/setups");
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(
    screen.queryByRole("link", { name: "New setup" }),
  ).not.toBeInTheDocument();
});
it("delete 401 removes protected setup UI", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([testSetup]),
    ),
    http.delete(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ error: "Expired" }, { status: 401 }),
    ),
  );
  renderSetupRoute("/my/setups");
  await screen.findByText(testSetup.title);
  const events = userEvent.setup();
  await events.click(screen.getByRole("button", { name: "Delete setup" }));
  await events.click(
    within(screen.getByRole("group", { name: "Confirm deletion" })).getByRole(
      "button",
      { name: "Confirm delete" },
    ),
  );
  await screen.findByRole("button", { name: "Sign in with Google" });
  expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
});
