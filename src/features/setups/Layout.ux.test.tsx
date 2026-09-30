import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { currentUserKey } from "../auth/queries";
import { testSetup, testUser } from "./testFixtures";
import { renderSetupRoute } from "./testUtils";
it("labels navigation and identifies the current route beyond color", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute("/my/setups");
  await screen.findByText("No setups yet.");
  const nav = within(screen.getByRole("navigation", { name: "Main" }));
  for (const name of ["Home", "My setups", "Friends", "Settings"])
    expect(nav.getByRole("link", { name })).toBeInTheDocument();
  expect(nav.getByRole("link", { name: "My setups" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
  );
  expect(screen.getByRole("link", { name: "New setup" })).toHaveAttribute(
    "href",
    "/my/setups/new",
  );
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#page-content",
  );
});
it("keeps long identity, title and historical chassis content readable alongside actions", async () => {
  const title = "Long track setup ".repeat(12);
  const brand = "Historical chassis brand ".repeat(12);
  const nickname = "LongDriver".repeat(6);
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () =>
      HttpResponse.json([
        {
          ...testSetup,
          title,
          chassis: { ...testSetup.chassis, brand_name: brand },
        },
      ]),
    ),
  );
  const { client } = renderSetupRoute("/my/setups");
  await screen.findByRole("heading", { name: title.trim() });
  client.setQueryData(currentUserKey, { ...testUser, nickname });
  expect(await screen.findByText(nickname)).toBeVisible();
  expect(
    screen.getByText(`${brand}RD2.0`.replace(/\s+/g, " ").trim()),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Edit setup" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Delete setup" })).toBeEnabled();
});
