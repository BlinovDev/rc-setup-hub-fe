import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../../api/config";
import { server } from "../../../test/server";
import { renderSetupRoute } from "../testUtils";
import { testSetup } from "../testFixtures";
it("warns on dirty route exit, keeps draft on Cancel, and discards only with explicit confirmation", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(testSetup),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json([]),
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  await screen.findByLabelText("Title");
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Dirty draft" },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("link", { name: "Back to my setups" }));
  expect(
    await screen.findByRole("dialog", { name: "Leave unsaved changes?" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Dirty draft");
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await user.click(screen.getByRole("link", { name: "Back to my setups" }));
  await user.click(
    screen.getByRole("button", { name: "Discard draft and leave" }),
  );
  await screen.findByText("No setups yet.");
});
it("guards queued files even with untouched fields", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute("/my/setups/new");
  await screen.findByLabelText("Title");
  fireEvent.change(screen.getByLabelText("Photo files"), {
    target: {
      files: [new File(["original"], "track.jpg", { type: "image/jpeg" })],
    },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("link", { name: "Back to my setups" }));
  expect(
    await screen.findByRole("dialog", { name: "Leave unsaved changes?" }),
  ).toHaveTextContent("Already saved photo changes are retained.");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByText("track.jpg")).toBeVisible();
});
it("successful saving clears the exit guard without recreating the document", async () => {
  let current = structuredClone(testSetup);
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(current),
    ),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json([]),
    ),
    http.patch(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      async ({ request }) => {
        current = {
          ...current,
          ...((await request.json()) as typeof testSetup),
        };
        return HttpResponse.json(current);
      },
    ),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
  await screen.findByLabelText("Title");
  const title = screen.getByLabelText("Title");
  fireEvent.change(title, { target: { value: "Saved baseline" } });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await screen.findByText("Setup saved.");
  expect(screen.getByLabelText("Title")).toBe(title);
  await user.click(screen.getByRole("link", { name: "Back to my setups" }));
  await screen.findByText("No setups yet.");
  expect(
    screen.queryByRole("dialog", { name: "Leave unsaved changes?" }),
  ).not.toBeInTheDocument();
});
