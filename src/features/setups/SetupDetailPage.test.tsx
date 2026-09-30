import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { renderSetupRoute } from "./testUtils";
import { detailKey } from "./queries";
import { shareNavigation } from "./share";
const publicOwner = {
  id: testUser.id,
  nickname: "Safe owner",
  avatar_url: "https://example.test/owner.png",
};
const path = `/setups/${testSetup.id}`;
afterEach(() => vi.restoreAllMocks());
function mockDetail(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json({ ...testSetup, ...overrides });
    }),
    http.get(`${apiUrl}/api/v1/users/${testSetup.owner_id}`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json(publicOwner);
    }),
  );
}
it("renders full historical technical data including zero and public owner, using the existing cache", async () => {
  mockDetail();
  const { client } = renderSetupRoute(path);
  await screen.findByRole("heading", { name: testSetup.title });
  await screen.findByText(/Safe owner/);
  expect(client.getQueryData(detailKey(testSetup.id))).toEqual(testSetup);
  expect(screen.getByRole("link", { name: "Safe owner" })).toHaveAttribute(
    "href",
    `/users/${testSetup.owner_id}`,
  );
  for (const value of [
    "Historical Yokomo RD2.0",
    "Old note",
    "25 mm",
    "Big bore",
    "MST",
    "Red",
    "100",
    "10.5T",
    "ESC model",
    "Servo",
    "Gyro",
    "Radio",
  ])
    expect(screen.getByText(value)).toBeInTheDocument();
  const front = screen
    .getByRole("heading", { name: "Front suspension" })
    .closest("section")!;
  expect(within(front).getByText("0")).toBeInTheDocument();
  expect(within(front).getByText("Toe (deg):")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Edit setup" })).toHaveAttribute(
    "href",
    `/my/setups/${testSetup.id}/edit`,
  );
  expect(document.querySelector("img")).toHaveAttribute(
    "src",
    publicOwner.avatar_url,
  );
  expect(screen.queryByText(testUser.email)).not.toBeInTheDocument();
});
it.each([
  {},
  { suspension: { front: { toe_deg: null } }, electronics: { motor: null } },
])(
  "empty or null technical data displays a useful empty state",
  async (data) => {
    mockDetail({ data, chassis: null, chassis_model_id: null });
    renderSetupRoute(path);
    await screen.findByText("No technical setup data yet.");
    expect(screen.getByText("Custom / not listed")).toBeInTheDocument();
  },
);
it("unsupported schema version preserves safe general data without interpreting technical data", async () => {
  mockDetail({ schema_version: 2, data: { unknown: true } });
  renderSetupRoute(path);
  await screen.findByText("This setup data version is not supported.");
  expect(screen.getByText(testSetup.title)).toBeInTheDocument();
  expect(screen.queryByText("Front suspension")).not.toBeInTheDocument();
});
it("another owner's setup has no owner-only edit action", async () => {
  const ownerId = testSetup.chassis_model_id;
  mockDetail({ owner_id: ownerId });
  server.use(
    http.get(`${apiUrl}/api/v1/users/${ownerId}`, () =>
      HttpResponse.json({ ...publicOwner, id: ownerId, avatar_url: null }),
    ),
  );
  renderSetupRoute(path);
  await screen.findByText(/Safe owner/);
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it.each([400, 404, 500, "network"])(
  "owner %s failure does not hide the setup",
  async (failure) => {
    mockDetail();
    server.use(
      http.get(`${apiUrl}/api/v1/users/${testSetup.owner_id}`, () =>
        failure === "network"
          ? HttpResponse.error()
          : HttpResponse.json(
              { error: "Private internals" },
              { status: Number(failure) },
            ),
      ),
    );
    renderSetupRoute(path);
    await screen.findByText("Owner: Owner unavailable");
    expect(screen.getByText(testSetup.title)).toBeInTheDocument();
    expect(screen.queryByText("Private internals")).not.toBeInTheDocument();
  },
);
it("invalid UUID makes no detail request", async () => {
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/:id`, () => {
      calls++;
      return HttpResponse.json(testSetup);
    }),
  );
  renderSetupRoute("/setups/bad-id");
  await screen.findByText("Setup not found or unavailable.");
  expect(calls).toBe(0);
});
it.each([400, 404])("detail %s is generic unavailable", async (status) => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ error: "Secret" }, { status }),
    ),
  );
  renderSetupRoute(path);
  await screen.findByText("Setup not found or unavailable.");
  expect(
    screen.queryByRole("link", { name: "Edit setup" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Secret")).not.toBeInTheDocument();
});
it.each([500, "network"])("retries detail %s failure", async (failure) => {
  let calls = 0;
  mockDetail();
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
      calls++;
      return calls > 1
        ? HttpResponse.json(testSetup)
        : failure === "network"
          ? HttpResponse.error()
          : HttpResponse.json({ error: "Internal" }, { status: 500 });
    }),
  );
  renderSetupRoute(path);
  await screen.findByRole("button", { name: "Retry setup" });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Retry setup" }));
  await screen.findByText(testSetup.title);
  expect(calls).toBe(2);
});
it.each(["detail", "owner"])(
  "%s 401 clears auth and removes protected detail",
  async (endpoint) => {
    mockDetail();
    server.use(
      http.get(
        endpoint === "detail"
          ? `${apiUrl}/api/v1/setups/${testSetup.id}`
          : `${apiUrl}/api/v1/users/${testSetup.owner_id}`,
        () => HttpResponse.json({ error: "Expired" }, { status: 401 }),
      ),
    );
    renderSetupRoute(path);
    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
  },
);
it("copies exactly the stable frontend URL without query parameters", async () => {
  mockDetail();
  const events = userEvent.setup();
  const copy = vi.spyOn(shareNavigation, "copy").mockResolvedValue();
  vi.spyOn(shareNavigation, "origin").mockReturnValue(
    "https://frontend.example",
  );
  renderSetupRoute(`${path}?temporary=ignored`);
  await screen.findByText(testSetup.title);
  await events.click(screen.getByRole("button", { name: "Copy link" }));
  expect(copy).toHaveBeenCalledExactlyOnceWith(
    `https://frontend.example${path}`,
  );
  await screen.findByText("Link copied.");
});
it("clipboard failure exposes a selectable stable URL and retry", async () => {
  mockDetail();
  const events = userEvent.setup();
  const copy = vi
    .spyOn(shareNavigation, "copy")
    .mockRejectedValueOnce(new Error("Denied"))
    .mockResolvedValueOnce();
  renderSetupRoute(path);
  await screen.findByText(testSetup.title);
  await events.click(screen.getByRole("button", { name: "Copy link" }));
  const input = await screen.findByRole("textbox", { name: "Share URL" });
  expect(input).toHaveValue(`${window.location.origin}${path}`);
  await events.click(screen.getByRole("button", { name: "Copy link" }));
  await screen.findByText("Link copied.");
  expect(copy).toHaveBeenCalledTimes(2);
});
