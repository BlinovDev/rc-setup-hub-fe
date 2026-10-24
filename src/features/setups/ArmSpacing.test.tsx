import { waitFor } from "@testing-library/react";
import { setupControl, setupButton } from "./form/testDriver";
import type { components } from "../../api/generated/schema";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { mockActiveCatalog, renderSetupRoute } from "./testUtils";

type Schemas = components["schemas"];
const field = (side: string, arm: string, position: string) =>
  `${side} ${arm} arm — ${position} spacers (mm)`;
const add = (side: string, arm: string) =>
  `Add ${arm} arm spacing — ${side.toLowerCase()} suspension`;

it.each([".", ","])(
  "creates %s totals, shows units/zero, reopens and preserves unrelated edits then removes/clears",
  async (separator) => {
    mockActiveCatalog();
    let saved: Schemas["Setup"] = structuredClone(testSetup);
    let created: Schemas["CreateSetup"] | undefined;
    let updated: Schemas["PatchSetup"] | undefined;
    server.use(
      http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
        expect(request.credentials).toBe("include");
        created = (await request.json()) as Schemas["CreateSetup"];
        saved = { ...saved, ...created };
        return HttpResponse.json(saved, { status: 201 });
      }),
      http.patch(
        `${apiUrl}/api/v1/setups/${testSetup.id}`,
        async ({ request }) => {
          expect(request.credentials).toBe("include");
          updated = (await request.json()) as Schemas["PatchSetup"];
          saved = { ...saved, ...updated };
          return HttpResponse.json(saved);
        },
      ),
      http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json(saved),
      ),
      http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([saved])),
      http.get(`${apiUrl}/api/v1/users/${testUser.id}`, () =>
        HttpResponse.json({
          id: testUser.id,
          nickname: testUser.nickname,
          avatar_url: null,
        }),
      ),
    );
    const { router } = renderSetupRoute("/my/setups/new");
    const user = userEvent.setup();
    await screen.findByLabelText("Title");
    await user.type(setupControl("Title"), "Arm spacing");
    for (const side of ["Front", "Rear"]) {
      for (const arm of ["top", "lower"]) {
        expect(
          screen.queryByLabelText(field(side, arm, "Front")),
        ).not.toBeInTheDocument();
        await user.click(setupButton({ name: add(side, arm) }));
        expect(
          screen.queryByRole("button", { name: add(side, arm) }),
        ).not.toBeInTheDocument();
        const front = setupControl(field(side, arm, "Front"));
        expect(front).toHaveValue("");
        expect(front).toHaveAttribute("inputmode", "decimal");
        if (side === "Front") await user.type(front, "0");
        await user.click(setupControl(field(side, arm, "Rear")));
        await user.paste(
          side === "Front" && arm === "lower" ? "0" : `5${separator}2`,
        );
      }
    }
    await user.type(setupControl("Front camber (degrees)"), "-6.8");
    await user.type(setupControl("Motor"), "Existing motor");
    await user.click(setupButton({ name: "Create setup" }));
    await screen.findByText("Setup created.");
    expect(created?.data).toEqual({
      suspension: {
        front: {
          camber_deg: -6.8,
          top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
          lower_arm_spacing: { front_mm: 0, rear_mm: 0 },
        },
        rear: {
          top_arm_spacing: { rear_mm: 5.2 },
          lower_arm_spacing: { rear_mm: 5.2 },
        },
      },
      electronics: { motor: "Existing motor" },
    });
    await act(() => router.navigate(`/setups/${testSetup.id}`));
    const top = (
      await screen.findByRole("heading", { name: "Front top arm spacing" })
    ).closest("section")!;
    expect(within(top).getByText("0 mm")).toBeInTheDocument();
    expect(within(top).getByText("5.2 mm")).toBeInTheDocument();
    const rear = screen
      .getByRole("heading", { name: "Rear top arm spacing" })
      .closest("section")!;
    expect(
      within(rear).queryByText("Front spacers (ahead of arm):"),
    ).not.toBeInTheDocument();
    expect(
      within(rear).getByText("Rear spacers (behind arm):"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    expect(setupControl(field("Front", "top", "Front"))).toHaveValue("0");
    expect(setupControl(field("Front", "top", "Rear"))).toHaveValue("5.2");
    expect(setupControl(field("Rear", "top", "Front"))).toHaveValue("");
    await user.type(setupControl("Title"), " renamed");
    await user.click(setupButton({ name: "Save setup" }));
    await screen.findByText("Setup saved.");
    expect(updated?.data).toEqual(created?.data);
    await act(() => router.navigate(`/setups/${testSetup.id}`));
    await screen.findByRole("link", { name: "Edit setup" });
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    await user.click(setupButton({ name: "Remove front top arm spacing" }));
    expect(
      screen.queryByLabelText(field("Front", "top", "Front")),
    ).not.toBeInTheDocument();
    await user.clear(setupControl(field("Front", "lower", "Front")));
    await user.clear(setupControl(field("Rear", "top", "Rear")));
    const updatedTotal = setupControl(field("Rear", "lower", "Rear"));
    await user.clear(updatedTotal);
    await user.type(updatedTotal, `0${separator}123456789`);
    await user.click(setupButton({ name: "Save setup" }));
    await screen.findByText("Setup saved.");
    expect(updated?.data).toEqual({
      suspension: {
        front: { camber_deg: -6.8, lower_arm_spacing: { rear_mm: 0 } },
        rear: { lower_arm_spacing: { rear_mm: 0.123456789 } },
      },
      electronics: { motor: "Existing motor" },
    });
    await act(() => router.navigate(`/setups/${testSetup.id}`));
    await screen.findByRole("link", { name: "Edit setup" });
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    expect(setupButton({ name: add("Front", "top") })).toBeInTheDocument();
    expect(setupButton({ name: add("Rear", "top") })).toBeInTheDocument();
    expect(setupControl(field("Front", "lower", "Rear"))).toHaveValue("0");
  },
  // Full create/detail/edit/clear journey on both axles, including real section actions.
  10000,
);

it("allows empty added blocks, removes them without stale values, and saves no empty parents", async () => {
  mockActiveCatalog();
  let created: Schemas["CreateSetup"] | undefined;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      created = (await request.json()) as Schemas["CreateSetup"];
      return HttpResponse.json({ ...testSetup, ...created }, { status: 201 });
    }),
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute("/my/setups/new");
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(setupControl("Title"), "Empty blocks");
  for (const side of ["Front", "Rear"])
    for (const arm of ["top", "lower"])
      await user.click(setupButton({ name: add(side, arm) }));
  await user.type(setupControl(field("Front", "top", "Front")), "5.2");
  await user.click(setupButton({ name: "Remove front top arm spacing" }));
  await user.click(setupButton({ name: add("Front", "top") }));
  expect(setupControl(field("Front", "top", "Front"))).toHaveValue("");
  await user.click(setupButton({ name: "Create setup" }));
  await screen.findByText("Setup created.");
  expect(created?.data).toEqual({});
});

it.each(["create", "edit"])(
  "blocks invalid %s totals with accessible errors and no writes",
  async (mode) => {
    mockActiveCatalog();
    let writes = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json(testSetup),
      ),
      http.post(`${apiUrl}/api/v1/setups`, () => {
        writes++;
        return HttpResponse.json(testSetup, { status: 201 });
      }),
      http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, () => {
        writes++;
        return HttpResponse.json(testSetup);
      }),
    );
    renderSetupRoute(
      mode === "create" ? "/my/setups/new" : `/my/setups/${testSetup.id}/edit`,
    );
    const user = userEvent.setup();
    await screen.findByLabelText("Title");
    if (mode === "create") await user.type(setupControl("Title"), "Invalid");
    await user.click(setupButton({ name: add("Rear", "lower") }));
    const input = setupControl(field("Rear", "lower", "Front"));
    for (const value of ["-0,1", "NaN", "Infinity", "1e999", "1,2.3", "1,,2"]) {
      await user.clear(input);
      await user.type(input, value);
      await user.click(
        setupButton({
          name: mode === "create" ? "Create setup" : "Save setup",
        }),
      );
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(
        "Enter a finite spacer total greater than or equal to zero.",
      );
      await waitFor(() => expect(input).toHaveFocus());
      expect(writes).toBe(0);
    }
  },
);
