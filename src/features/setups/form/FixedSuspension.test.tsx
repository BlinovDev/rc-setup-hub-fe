import { http, HttpResponse } from "msw";
import { server } from "../../../test/server";
import { apiUrl } from "../../../api/config";
import { createSetup, patchSetup } from "../api";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupFormSchema, type SetupFormValues } from "./formSchema";
import { comparisonSections } from "../../compare/model";
import { TechnicalData } from "../TechnicalData";
import { standardLinks } from "../suspensionLinks";
import { expect, it, vi } from "vitest";
import { SetupForm } from "./SetupForm";
import { setupToForm, serializeData } from "./serialization";
import { testSetup } from "../testFixtures";

it("loads fixed standard properties and saves them without predefined custom rows", () => {
  const setup = {
    ...testSetup,
    data: {
      suspension: {
        front: { upper_arm_length_mm: 42.5 },
        rear: { lower_arm_length_mm: 51.2 },
      },
    },
  };
  const values = setupToForm(setup);
  expect(values.front).toHaveProperty("upper_arm_length_mm", "42.5");
  expect(values.rear).toHaveProperty("lower_arm_length_mm", "51.2");
  expect(serializeData(values)).toEqual(setup.data);
});
it("always shows regular standard inputs without standard rename/removal workflows", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={{
          ...testSetup,
          data: {
            suspension: {
              front: { link_lengths: [{ name: "upper_arm", length_mm: 42.5 }] },
            },
          },
        }}
        onSave={vi.fn()}
        pending={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Front" }),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Link lengths" }));
  expect(screen.getByLabelText("Front Upper arm length (mm)")).toHaveValue(
    "42.5",
  );
  expect(
    screen.queryByRole("button", { name: /Remove front link/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Saved link name:/)).not.toBeInTheDocument();
});
const fields = (["front", "rear"] as const).flatMap((side) =>
  standardLinks(side).map((item) => ({ side, ...item })),
);
it.each(fields)(
  "keeps $side.$field optional, finite/positive and precise",
  ({ side, field }) => {
    const values = setupToForm();
    values.title = "Fixed fields";
    for (const raw of ["", " ", "42.123456789", "42,123456789"]) {
      values[side][field] = raw;
      expect(setupFormSchema.safeParse(values).success).toBe(true);
      const data = serializeData(values);
      if (!raw.trim()) expect(data).toEqual({});
      else expect(data.suspension?.[side]).toEqual({ [field]: 42.123456789 });
      expect(values[side].link_lengths).toEqual([]);
    }
    for (const raw of ["0", "-1", "Infinity", "NaN", "16,2.3", "1e999"]) {
      values[side][field] = raw;
      const result = setupFormSchema.safeParse(values);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(
          result.error.issues.some(
            (i) => i.path.join(".") === `${side}.${field}`,
          ),
        ).toBe(true);
      expect(() => serializeData(values)).toThrow();
    }
  },
);
it.each(fields)(
  "converts or clears only the unique exact legacy $side.$name after an explicit value change",
  ({ side, name, field }) => {
    const setup = {
      ...testSetup,
      data: {
        suspension: {
          [side]: {
            camber_deg: 0,
            top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
            lower_arm_spacing: { rear_mm: 0 },
            link_lengths: [
              { name: "Before", length_mm: 17 },
              { name, length_mm: 42.123456789 },
              { name: "After" },
            ],
          },
        },
      },
    };
    const values = setupToForm(setup);
    expect(values[side][field]).toBe("42.123456789");
    values.title = "Title only";
    expect(serializeData(values)).toEqual(setup.data);
    values[side][field] = "43,23456789";
    expect(setupFormSchema.safeParse(values).success).toBe(true);
    expect(serializeData(values).suspension?.[side]).toEqual({
      ...setup.data.suspension[side],
      [field]: 43.23456789,
      link_lengths: [{ name: "Before", length_mm: 17 }, { name: "After" }],
    });
    values[side][field] = "";
    expect(serializeData(values).suspension?.[side]).toEqual({
      ...setup.data.suspension[side],
      link_lengths: [{ name: "Before", length_mm: 17 }, { name: "After" }],
    });
    const reopened = setupToForm({ ...setup, data: serializeData(values) });
    expect(reopened[side][field]).toBe("");
    expect(
      reopened[side].link_lengths.every((link) => !link.legacyStandard),
    ).toBe(true);
  },
);
it("does not promote duplicate, case-varied, padded, translated or rear steering names", () => {
  const links = [
    { name: "upper_arm", length_mm: 40 },
    { name: "upper_arm", length_mm: 41 },
    { name: "Upper arm", length_mm: 42 },
    { name: " lower_arm ", length_mm: 43 },
    { name: "Lower", length_mm: 44 },
    { name: "steering_tie_rod", length_mm: 45 },
  ];
  const setup = {
    ...testSetup,
    data: { suspension: { rear: { link_lengths: links } } },
  };
  const values = setupToForm(setup);
  expect(values.rear.upper_arm_length_mm).toBe("");
  expect(values.rear.lower_arm_length_mm).toBe("");
  expect(values.rear.steering_tie_rod_length_mm).toBe("");
  expect(values.rear.link_lengths.every((link) => !link.legacyStandard)).toBe(
    true,
  );
  // Normal name trimming is pre-existing serialization behavior; no row is promoted or dropped.
  expect(serializeData(values).suspension?.rear?.link_lengths).toEqual(
    links.map((l) => ({ ...l, name: l.name.trim() })),
  );
});
it("blocks dual representations and ambiguous conversion, retaining every draft", () => {
  const setup = {
    ...testSetup,
    data: {
      suspension: {
        front: { link_lengths: [{ name: "upper_arm", length_mm: 42 }] },
      },
    },
  };
  const values = setupToForm(setup);
  values.front.upper_arm_length_mm = "";
  values.front.link_lengths.push({ name: "upper_arm", length_mm: "43" });
  expect(setupFormSchema.safeParse(values).success).toBe(false);
  expect(() => serializeData(values)).toThrow(/duplicate/);
  expect(values.front.link_lengths).toHaveLength(2);
  const fresh = setupToForm();
  fresh.title = "Collision";
  fresh.front.upper_arm_length_mm = "45";
  fresh.front.link_lengths = [{ name: "upper_arm", length_mm: "46" }];
  expect(setupFormSchema.safeParse(fresh).success).toBe(false);
  expect(() => serializeData(fresh)).toThrow(/duplicate/);
  fresh.front.link_lengths[0]!.name = "Custom arm";
  expect(setupFormSchema.safeParse(fresh).success).toBe(true);
  fresh.rear.steering_tie_rod_length_mm = "1";
  expect(setupFormSchema.safeParse(fresh).success).toBe(false);
  expect(() => serializeData(fresh)).toThrow(/front only/);
});
it("keeps custom labels distinct from standard identities and compares unique legacy against typed values", () => {
  const a = {
    ...testSetup,
    data: {
      suspension: {
        front: {
          upper_arm_length_mm: 42.5,
          camber_deg: 0,
          link_lengths: [
            { name: "Upper arm", length_mm: 9 },
            { name: "Unknown" },
          ],
        },
      },
    },
  };
  const b = {
    ...testSetup,
    data: {
      suspension: {
        front: {
          link_lengths: [
            { name: "upper_arm", length_mm: 42.5 },
            { name: "Upper arm", length_mm: 9 },
            { name: "Unknown", length_mm: 0 },
          ],
        },
      },
    },
  };
  expect(comparisonSections(a, b, true)).toEqual([]);
  const section = comparisonSections(a, b, false).find(
    (s) => s.title === "Front suspension",
  )!;
  const upper = section.rows.filter((r) => r.label === "Upper arm (mm)");
  expect(upper).toHaveLength(2);
  expect(new Set(upper.map((r) => r.key)).size).toBe(2);
  expect(upper.map((r) => r.left)).toEqual(["42.5", "9"]);
  const c = structuredClone(a);
  c.data.suspension.front.upper_arm_length_mm = 43.5;
  expect(comparisonSections(a, c, true)).toEqual([
    expect.objectContaining({
      title: "Front suspension",
      rows: [
        expect.objectContaining({
          label: "Upper arm (mm)",
          left: "42.5",
          right: "43.5",
        }),
      ],
    }),
  ]);
});
it("shows the five fixed missing detail rows, and legacy zero stays specified on read", () => {
  const { rerender } = render(<TechnicalData data={{}} />);
  expect(screen.getAllByText("Not specified")).toHaveLength(5);
  expect(screen.getAllByText("Upper arm:")).toHaveLength(2);
  expect(screen.getAllByText("Lower arm:")).toHaveLength(2);
  expect(screen.getByText("Steering tie rod:")).toBeVisible();
  rerender(
    <TechnicalData
      data={{
        suspension: {
          front: { upper_arm_length_mm: 0 },
          rear: { link_lengths: [{ name: "lower_arm", length_mm: 0 }] },
        },
      }}
    />,
  );
  expect(screen.getAllByText("0 mm")).toHaveLength(2);
  expect(screen.getAllByText("Not specified")).toHaveLength(3);
});
it("keeps spacing inputs visible beside fixed inputs and confirms component clearing", async () => {
  const user = userEvent.setup(),
    save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(
      async () => true,
    );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={{
          ...testSetup,
          data: {
            suspension: {
              front: {
                upper_arm_length_mm: 42.5,
                camber_deg: 0,
                top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
              },
            },
          },
        }}
        onSave={save}
        pending={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Front" }),
  );
  const ahead = () =>
    screen.getByLabelText("Front top arm — Front spacers (mm)");
  expect(ahead()).toHaveValue("0");
  await user.click(
    screen.getByRole("button", { name: "Remove Front top arm spacing" }),
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(ahead()).toHaveValue("0");
  await user.click(
    screen.getByRole("button", { name: "Remove Front top arm spacing" }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "Confirm remove Front top arm spacing",
    }),
  );
  expect(ahead()).toHaveValue("");
  await user.type(ahead(), "0");
  await user.type(
    screen.getByLabelText("Front top arm — Rear spacers (mm)"),
    "5,2",
  );
  expect(screen.getByLabelText("Front Upper arm length (mm)")).toHaveValue(
    "42.5",
  );
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(serializeData(save.mock.calls[0]![0])).toEqual({
    suspension: {
      front: {
        upper_arm_length_mm: 42.5,
        camber_deg: 0,
        top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
      },
    },
  });
});

it("normalizes only the rear unset tie-rod slot at the credentialed write boundary", async () => {
  const data = {
    suspension: {
      front: { steering_tie_rod_length_mm: 16.23456789 },
      rear: {
        lower_arm_length_mm: 42.5,
        steering_tie_rod_length_mm: null,
        top_arm_spacing: { front_mm: 0, rear_mm: 5.2 },
        link_lengths: [{ name: "steering_tie_rod", length_mm: 17 }],
      },
    },
  };
  const before = structuredClone(data),
    payloads: unknown[] = [];
  server.use(
    http.post(`${apiUrl}/api/v1/setups`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      payloads.push(await request.json());
      return HttpResponse.json(testSetup, { status: 201 });
    }),
    http.patch(
      `${apiUrl}/api/v1/setups/${testSetup.id}`,
      async ({ request }) => {
        expect(request.credentials).toBe("include");
        payloads.push(await request.json());
        return HttpResponse.json(testSetup);
      },
    ),
  );
  await createSetup({ title: "Fixed", visibility: "private", data });
  await patchSetup(testSetup.id, { data });
  await patchSetup(testSetup.id, { notes: "Only notes" });
  const expected = structuredClone(data);
  delete (expected.suspension.rear as { steering_tie_rod_length_mm?: null })
    .steering_tie_rod_length_mm;
  expect(payloads).toEqual([
    { title: "Fixed", visibility: "private", data: expected },
    { data: expected },
    { notes: "Only notes" },
  ]);
  expect(data).toEqual(before);
});
it("never exposes or substitutes the mapped original row when custom additions reuse its key", async () => {
  const save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(
      async () => true,
    ),
    user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={{
          ...testSetup,
          data: {
            suspension: {
              front: { link_lengths: [{ name: "upper_arm", length_mm: 42 }] },
            },
          },
        }}
        onSave={save}
        pending={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: "Front" }),
  );
  const fixed = screen.getByLabelText("Front Upper arm length (mm)");
  await user.clear(fixed);
  await user.type(fixed, "43,5");
  await user.click(screen.getByRole("button", { name: "Add front link" }));
  await user.type(screen.getByLabelText("Front link 2 name"), "upper_arm");
  await user.type(screen.getByLabelText("Front link 2 length (mm)"), "45");
  await user.click(screen.getByRole("button", { name: "Add front link" }));
  await user.type(screen.getByLabelText("Front link 3 name"), "Other");
  await user.type(screen.getByLabelText("Front link 3 length (mm)"), "46");
  expect(screen.queryByLabelText("Front link 1 name")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Remove front link 1" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Front link 2 name")).toHaveFocus(),
  );
  expect(save).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Front link 2 name"));
  await user.type(screen.getByLabelText("Front link 2 name"), "Cable");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(serializeData(save.mock.calls[0]![0])).toEqual({
    suspension: {
      front: {
        upper_arm_length_mm: 43.5,
        link_lengths: [
          { name: "Cable", length_mm: 45 },
          { name: "Other", length_mm: 46 },
        ],
      },
    },
  });
});
it("refuses to consume a different custom row as legacy conversion provenance", () => {
  const values = setupToForm({
    ...testSetup,
    data: {
      suspension: {
        front: { link_lengths: [{ name: "upper_arm", length_mm: 42 }] },
      },
    },
  });
  values.front.link_lengths[0]!.name = "Renamed";
  values.front.link_lengths.push({ name: "upper_arm", length_mm: "45" });
  values.front.upper_arm_length_mm = "43";
  expect(setupFormSchema.safeParse(values).success).toBe(false);
  expect(() => serializeData(values)).toThrow(/duplicate/);
  expect(values.front.link_lengths.map((l) => l.length_mm)).toEqual([
    "42",
    "45",
  ]);
});
it("can clear or correct a historical zero without validating the legacy row removed from the payload", () => {
  const values = setupToForm({
    ...testSetup,
    data: {
      suspension: {
        front: {
          link_lengths: [
            { name: "upper_arm", length_mm: 0 },
            { name: "Custom", length_mm: 17 },
          ],
        },
      },
    },
  });
  const invalid = setupFormSchema.safeParse(values);
  expect(invalid.success).toBe(false);
  if (!invalid.success)
    expect(invalid.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "front.upper_arm_length_mm",
    ]);
  values.front.upper_arm_length_mm = "42,5";
  expect(setupFormSchema.safeParse(values).success).toBe(true);
  expect(serializeData(values)).toEqual({
    suspension: {
      front: {
        upper_arm_length_mm: 42.5,
        link_lengths: [{ name: "Custom", length_mm: 17 }],
      },
    },
  });
  values.front.upper_arm_length_mm = "";
  expect(setupFormSchema.safeParse(values).success).toBe(true);
  expect(serializeData(values)).toEqual({
    suspension: {
      front: { link_lengths: [{ name: "Custom", length_mm: 17 }] },
    },
  });
});
