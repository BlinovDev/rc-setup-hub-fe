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
const decimalSetup: Schemas["Setup"] = {
  ...testSetup,
  data: {
    ...testSetup.data,
    suspension: {
      front: {
        camber_deg: -1.5,
        caster_deg: 6.8,
        toe_deg: 0,
        link_lengths: [{ name: "Upper", length_mm: 16.2 }],
      },
      rear: {
        camber_deg: -0.25,
        caster_deg: 6.8,
        link_lengths: [{ name: "Rear", length_mm: 0.25 }],
      },
    },
  },
};

it.each([".", ","])(
  "creates typed/pasted %s decimals, displays and reopens them, then preserves them after an unrelated edit",
  async (separator) => {
    mockActiveCatalog();
    let saved: Schemas["Setup"] = structuredClone(decimalSetup);
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
    await user.type(screen.getByLabelText("Title"), "Decimal setup");
    for (const side of ["Front", "Rear"]) {
      const camber = screen.getByLabelText(`${side} camber (degrees)`);
      await user.type(camber, "-");
      expect(camber).toHaveValue("-");
      await user.type(camber, `1${separator}`);
      expect(camber).toHaveValue(`-1${separator}`);
      await user.type(camber, "5");
      const caster = screen.getByLabelText(`${side} caster (degrees)`);
      await user.click(caster);
      await user.paste(`6${separator}8`);
      await user.type(screen.getByLabelText(`${side} toe (degrees)`), "0");
      await user.click(
        screen.getByRole("button", { name: `Add ${side.toLowerCase()} link` }),
      );
      await user.type(screen.getByLabelText(`${side} link 1 name`), "Upper");
      await user.click(screen.getByLabelText(`${side} link 1 length (mm)`));
      await user.paste(`16${separator}2`);
    }
    await user.click(screen.getByRole("button", { name: "Create setup" }));
    await screen.findByText("Setup created.");
    const expected = {
      camber_deg: -1.5,
      caster_deg: 6.8,
      toe_deg: 0,
      link_lengths: [{ name: "Upper", length_mm: 16.2 }],
    };
    expect(created?.data).toEqual({
      suspension: { front: expected, rear: expected },
    });
    await act(() => router.navigate(`/setups/${testSetup.id}`));
    for (const side of ["Front", "Rear"]) {
      const section = (
        await screen.findByRole("heading", { name: `${side} suspension` })
      ).closest("section")!;
      for (const value of ["-1.5", "6.8", "0", "16.2 mm"])
        expect(within(section).getByText(value)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    for (const side of ["Front", "Rear"]) {
      expect(screen.getByLabelText(`${side} camber (degrees)`)).toHaveValue(
        "-1.5",
      );
      expect(screen.getByLabelText(`${side} caster (degrees)`)).toHaveValue(
        "6.8",
      );
      expect(screen.getByLabelText(`${side} toe (degrees)`)).toHaveValue("0");
      expect(screen.getByLabelText(`${side} link 1 length (mm)`)).toHaveValue(
        "16.2",
      );
    }
    await user.type(screen.getByLabelText("Title"), " renamed");
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await screen.findByText("Setup saved.");
    expect(updated?.data).toEqual(created?.data);
    await act(() => router.navigate(`/setups/${testSetup.id}`));
    await screen.findByRole("link", { name: "Edit setup" });
    await user.click(screen.getByRole("link", { name: "Edit setup" }));
    await screen.findByLabelText("Title");
    expect(screen.getByLabelText("Rear link 1 length (mm)")).toHaveValue(
      "16.2",
    );
  },
);

it.each([".", ","])(
  "updates all scoped fields using %s fractions and preserves fine decimals on reopen",
  async (separator) => {
    let saved = structuredClone(decimalSetup);
    let updated: Schemas["PatchSetup"] | undefined;
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
        HttpResponse.json(saved),
      ),
      http.patch(
        `${apiUrl}/api/v1/setups/${testSetup.id}`,
        async ({ request }) => {
          updated = (await request.json()) as Schemas["PatchSetup"];
          saved = { ...saved, ...updated };
          return HttpResponse.json(saved);
        },
      ),
    );
    const { router } = renderSetupRoute(`/my/setups/${testSetup.id}/edit`);
    const user = userEvent.setup();
    await screen.findByLabelText("Title");
    for (const side of ["Front", "Rear"]) {
      for (const [field, value] of [
        ["camber", `-0${separator}25`],
        ["caster", `6${separator}8`],
        ["toe", `0${separator}25`],
      ] as const) {
        const input = screen.getByLabelText(`${side} ${field} (degrees)`);
        await user.clear(input);
        await user.type(input, value);
      }
      const length = screen.getByLabelText(`${side} link 1 length (mm)`);
      await user.clear(length);
      await user.click(length);
      await user.paste(`16${separator}2`);
      await user.click(
        screen.getByRole("button", { name: `Add ${side.toLowerCase()} link` }),
      );
      await user.type(screen.getByLabelText(`${side} link 2 name`), "Fine");
      await user.type(
        screen.getByLabelText(`${side} link 2 length (mm)`),
        `0${separator}25`,
      );
      await user.click(
        screen.getByRole("button", { name: `Add ${side.toLowerCase()} link` }),
      );
      await user.click(
        screen.getByRole("button", {
          name: `Remove ${side.toLowerCase()} link 3`,
        }),
      );
    }
    await user.clear(screen.getByLabelText("Rear toe (degrees)"));
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await screen.findByText("Setup saved.");
    for (const side of ["front", "rear"] as const) {
      expect(updated?.data?.suspension?.[side]).toEqual({
        camber_deg: -0.25,
        caster_deg: 6.8,
        ...(side === "front" ? { toe_deg: 0.25 } : {}),
        link_lengths: [
          { name: side === "front" ? "Upper" : "Rear", length_mm: 16.2 },
          { name: "Fine", length_mm: 0.25 },
        ],
      });
    }
    expect(updated?.data?.shocks).toEqual(decimalSetup.data.shocks);
    expect(updated?.data?.electronics).toEqual(decimalSetup.data.electronics);
    mockActiveCatalog();
    await act(() => router.navigate("/my/setups/new"));
    await act(() => router.navigate(`/my/setups/${testSetup.id}/edit`));
    await screen.findByLabelText("Title");
    expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue(
      "-0.25",
    );
    expect(screen.getByLabelText("Rear link 2 length (mm)")).toHaveValue(
      "0.25",
    );
    expect(screen.getByLabelText("Rear toe (degrees)")).toHaveValue("");
  },
);

it("blocks malformed angles and nonpositive/blank lengths with associated errors and no HTTP writes", async () => {
  mockActiveCatalog();
  let posts = 0;
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, () => {
      posts++;
      return HttpResponse.json(testSetup, { status: 201 });
    }),
  );
  renderSetupRoute("/my/setups/new");
  const user = userEvent.setup();
  await screen.findByLabelText("Title");
  await user.type(screen.getByLabelText("Title"), "Invalid decimals");
  const angle = screen.getByLabelText("Front caster (degrees)");
  await user.type(angle, "16,2.3");
  await user.click(screen.getByRole("button", { name: "Add rear link" }));
  await user.type(screen.getByLabelText("Rear link 1 name"), "Rear");
  const length = screen.getByLabelText("Rear link 1 length (mm)");
  for (const value of ["", "0,0", "-0,25", "Infinity"]) {
    await user.clear(length);
    if (value) await user.type(length, value);
    await user.click(screen.getByRole("button", { name: "Create setup" }));
    await screen.findByText("Enter a finite length greater than zero.");
    expect(angle).toHaveAttribute("aria-invalid", "true");
    expect(angle).toHaveAccessibleDescription("Enter a finite number.");
    expect(length).toHaveAccessibleDescription(
      "Enter a finite length greater than zero.",
    );
    expect(angle).toHaveFocus();
    expect(posts).toBe(0);
  }
});
