import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { components } from "../../../api/generated/schema";
import { testSetup } from "../testFixtures";
import { SetupForm } from "./SetupForm";
import { serializeData, serializePatch, setupToForm } from "./serialization";
import { setupFormSchema } from "./formSchema";
import type { SetupFormValues } from "./formSchema";
import {
  preferredSuspensionView,
  standardLinkIndices,
  standardLinks,
} from "../suspensionLinks";
import { comparisonSections } from "../../compare/model";
import { TechnicalData } from "../TechnicalData";
type Setup = components["schemas"]["Setup"];
function show(
  data: Setup["data"] = {},
  save = vi.fn<(values: SetupFormValues) => Promise<boolean>>(async () => true),
) {
  const setup = { ...testSetup, data };
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SetupForm setup={setup} onSave={save} pending={false} />
    </QueryClientProvider>,
  );
  return { save, view, setup, client };
}
function section(name: string) {
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name }),
  );
}
const tab = (name: string) => screen.getByRole("tab", { name });
it.each(["Front", "Rear"])(
  "provides exactly two accessible %s view tabs without clearing values or submitting",
  async (side) => {
    const { save } = show();
    const user = userEvent.setup();
    section(side);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(tab("Angles")).toHaveAttribute("aria-selected", "true");
    const angle = screen.getByLabelText(`${side} camber (degrees)`);
    await user.type(angle, "0");
    await user.click(tab("Link lengths"));
    expect(angle).not.toBeVisible();
    const lower = screen.getByLabelText(`${side} Lower arm length (mm)`);
    await user.type(lower, "42,123456789");
    expect(lower).toHaveAttribute("inputmode", "decimal");
    const upper = screen.getByLabelText(`${side} Upper arm length (mm)`);
    expect(upper).toHaveValue("");
    if (side === "Front")
      expect(
        screen.getByLabelText("Front Steering tie rod length (mm)"),
      ).toHaveValue("");
    else
      expect(
        screen.queryByLabelText(/Rear Steering tie rod/),
      ).not.toBeInTheDocument();
    const selected = tab("Link lengths");
    expect(selected).toHaveAttribute(
      "aria-controls",
      screen.getByRole("tabpanel").id,
    );
    selected.focus();
    await user.keyboard("{Home}");
    expect(tab("Angles")).toHaveFocus();
    expect(angle).toBeVisible();
    expect(angle).toHaveValue("0");
    await user.keyboard("{ArrowRight}");
    expect(tab("Link lengths")).toHaveFocus();
    expect(lower).toHaveValue("42,123456789");
    section(side === "Front" ? "Rear" : "Front");
    section(side);
    expect(tab("Link lengths")).toHaveAttribute("aria-selected", "true");
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(serializePatch(save.mock.calls[0]![0]).data).toEqual({
      suspension: {
        [side.toLowerCase()]: {
          camber_deg: 0,
          link_lengths: [{ name: "lower_arm", length_mm: 42.123456789 }],
        },
      },
    });
  },
);
it("does not dirty or serialize untouched standard fields when visiting either tab", async () => {
  const { save } = show();
  const user = userEvent.setup();
  section("Front");
  await user.click(tab("Link lengths"));
  section("Rear");
  await user.click(tab("Link lengths"));
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(serializeData(save.mock.calls[0]![0])).toEqual({});
});
it.each([
  [
    { front: { link_lengths: [{ name: "upper_arm", length_mm: 25 }] } },
    "Link lengths",
  ],
  [{ front: { link_lengths: [{ name: "Custom" }] } }, "Link lengths"],
  [
    {
      front: {
        camber_deg: 0,
        link_lengths: [{ name: "upper_arm", length_mm: 25 }],
      },
    },
    "Angles",
  ],
  [{ front: { camber_deg: 0 } }, "Angles"],
])(
  "prefers populated content, with Angles winning when both are populated",
  (suspension, expected) => {
    show({ suspension });
    section("Front");
    expect(tab(expected as string)).toHaveAttribute("aria-selected", "true");
  },
);
it("preserves legacy names/order/duplicates, supports rename, unknown values and safe individual removal", async () => {
  const data: Setup["data"] = {
    ...testSetup.data,
    suspension: {
      front: {
        link_lengths: [
          { name: "Upper", length_mm: 25 },
          { name: "upper_arm", length_mm: 26 },
          { name: "Custom old" },
        ],
      },
      rear: { link_lengths: [{ name: "steering_tie_rod", length_mm: 15 }] },
    },
  };
  const { save } = show(data);
  const user = userEvent.setup();
  section("Front");
  expect(tab("Link lengths")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Front Upper arm length (mm)")).toHaveValue(
    "25",
  );
  expect(screen.getByLabelText("Front link 2 name")).toHaveValue("upper_arm");
  await user.clear(screen.getByLabelText("Front link 3 name"));
  await user.type(screen.getByLabelText("Front link 3 name"), "Renamed custom");
  await user.click(screen.getByRole("button", { name: "Remove front link 2" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("Front link 2 name")).toHaveValue("upper_arm");
  await user.click(screen.getByRole("button", { name: "Remove front link 2" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm remove front link 2" }),
  );
  expect(screen.getByLabelText("Front link 2 name")).toHaveValue(
    "Renamed custom",
  );
  section("Rear");
  expect(screen.getByLabelText("Rear link 1 name")).toHaveValue(
    "steering_tie_rod",
  );
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(serializeData(save.mock.calls[0]![0])).toEqual({
    ...data,
    suspension: {
      front: {
        link_lengths: [
          { name: "Upper", length_mm: 25 },
          { name: "Renamed custom" },
        ],
      },
      rear: data.suspension!.rear,
    },
  });
});
it.each(["0", "-1", "Infinity", "16,2.3"])(
  "reveals a hidden invalid standard length %s and focuses it",
  async (value) => {
    const { save } = show();
    const user = userEvent.setup();
    section("Front");
    await user.click(tab("Link lengths"));
    const length = screen.getByLabelText("Front Steering tie rod length (mm)");
    await user.type(length, value);
    await user.click(tab("Angles"));
    section("General");
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await waitFor(() => expect(length).toHaveFocus());
    expect(tab("Link lengths")).toHaveAttribute("aria-selected", "true");
    expect(length).toHaveAttribute("aria-invalid", "true");
    expect(length).toHaveAccessibleDescription(
      "Enter a finite length greater than zero.",
    );
    expect(save).not.toHaveBeenCalled();
  },
);
it("reveals hidden angle errors while retaining link values", async () => {
  const { save } = show();
  const user = userEvent.setup();
  section("Rear");
  await user.type(screen.getByLabelText("Rear toe (degrees)"), "-");
  await user.click(tab("Link lengths"));
  await user.type(screen.getByLabelText("Rear Upper arm length (mm)"), "16,2");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Rear toe (degrees)")).toHaveFocus(),
  );
  expect(tab("Angles")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Rear Upper arm length (mm)")).toHaveValue(
    "16,2",
  );
  expect(save).not.toHaveBeenCalled();
});
it("keeps missing/null lengths blank through form, validation, serialization, detail and comparison", () => {
  const setup = {
    ...testSetup,
    data: {
      suspension: {
        front: {
          camber_deg: 0,
          link_lengths: [
            { name: "upper_arm" },
            { name: "lower_arm", length_mm: null },
            { name: "steering_tie_rod", length_mm: 16.2 },
          ],
        },
      },
    },
  };
  const values = setupToForm(setup);
  expect(values.front.link_lengths.map((l) => l.length_mm)).toEqual([
    "",
    "",
    "16.2",
  ]);
  expect(setupFormSchema.safeParse(values).success).toBe(true);
  expect(serializeData(values)).toEqual({
    suspension: {
      front: {
        camber_deg: 0,
        link_lengths: [
          { name: "upper_arm" },
          { name: "lower_arm" },
          { name: "steering_tie_rod", length_mm: 16.2 },
        ],
      },
    },
  });
  render(<TechnicalData data={setup.data} />);
  expect(screen.getByText("Upper arm:")).toBeVisible();
  expect(screen.getAllByText("Not specified")).toHaveLength(2);
  const b = {
    ...setup,
    id: testSetup.owner_id,
    data: {
      suspension: {
        front: {
          camber_deg: 0,
          link_lengths: [
            { name: "Tie rod", length_mm: 17 },
            { name: "Upper arm", length_mm: 25 },
          ],
        },
      },
    },
  };
  const diff = comparisonSections(setup, b, true);
  expect(diff.map((s) => s.title)).toEqual(["Front suspension"]);
  expect(diff[0]!.rows.map((r) => r.label)).toEqual(["Steering tie rod (mm)"]);
  const noDifferences = comparisonSections(setup, { ...setup, id: b.id }, true);
  expect(noDifferences).toEqual([]);
});
it("matches standard aliases without rewriting rear custom steering identities", () => {
  expect(standardLinks("front").map((l) => l.name)).toEqual([
    "upper_arm",
    "lower_arm",
    "steering_tie_rod",
  ]);
  expect(standardLinks("rear").map((l) => l.name)).toEqual([
    "upper_arm",
    "lower_arm",
  ]);
  expect([
    ...standardLinkIndices(
      [{ name: "Upper" }, { name: "upper_arm" }, { name: "Steering tie rod" }],
      "front",
    ),
  ]).toEqual([
    ["upper_arm", 0],
    ["steering_tie_rod", 2],
  ]);
  expect(standardLinkIndices([{ name: "steering_tie_rod" }], "rear").size).toBe(
    0,
  );
  expect(preferredSuspensionView(setupToForm().front)).toBe("angles");
});
it.each(["front", "rear"] as const)(
  "retains optional unknowns and precise values in every %s angles/lengths combination",
  (side) => {
    for (const angles of [false, true])
      for (const lengths of [false, true]) {
        const values = setupToForm();
        values.title = "Optional";
        if (angles) values[side].camber_deg = "0";
        if (lengths)
          values[side].link_lengths = [
            { name: "upper_arm", length_mm: "16,23456789" },
            { name: "lower_arm", length_mm: "" },
            { name: "Custom unknown", length_mm: "" },
          ];
        expect(setupFormSchema.safeParse(values).success).toBe(true);
        const data = serializeData(values);
        if (!angles && !lengths) expect(data).toEqual({});
        else
          expect(data.suspension?.[side]).toEqual({
            ...(angles ? { camber_deg: 0 } : {}),
            ...(lengths
              ? {
                  link_lengths: [
                    { name: "upper_arm", length_mm: 16.23456789 },
                    { name: "lower_arm" },
                    { name: "Custom unknown" },
                  ],
                }
              : {}),
          });
      }
  },
);
it("reveals a hidden invalid saved name and opens its disclosure before focusing", async () => {
  const { save } = show({
    suspension: {
      front: { link_lengths: [{ name: "upper_arm", length_mm: 42 }] },
    },
  });
  section("Front");
  const name = document.querySelector<HTMLInputElement>(
    '[name="front.link_lengths.0.name"]',
  )!;
  name.closest("details")!.open = true;
  fireEvent.change(name, { target: { value: "" } });
  name.closest("details")!.open = false;
  fireEvent.click(tab("Angles"));
  section("General");
  fireEvent.click(screen.getByRole("button", { name: "Save setup" }));
  await waitFor(() => expect(name).toHaveFocus());
  expect(tab("Link lengths")).toHaveAttribute("aria-selected", "true");
  expect(name.closest("details")).toHaveAttribute("open");
  expect(save).not.toHaveBeenCalled();
});
it("uses the freshly loaded suspension values after an explicit conflict reload", () => {
  const client = new QueryClient();
  const node = (version: number, data: Setup["data"]) => (
    <QueryClientProvider client={client}>
      <SetupForm
        setup={{ ...testSetup, data }}
        resetVersion={version}
        onSave={async () => true}
        pending={false}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(
    node(0, { suspension: { front: { camber_deg: 0 } } }),
  );
  section("Front");
  fireEvent.click(tab("Link lengths"));
  fireEvent.change(screen.getByLabelText("Front Upper arm length (mm)"), {
    target: { value: "18" },
  });
  rerender(
    node(1, {
      suspension: {
        front: { link_lengths: [{ name: "upper_arm", length_mm: 43 }] },
        rear: { toe_deg: 0 },
      },
    }),
  );
  section("Front");
  expect(tab("Link lengths")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Front Upper arm length (mm)")).toHaveValue(
    "43",
  );
  fireEvent.click(tab("Angles"));
  expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue("");
  section("Rear");
  expect(tab("Angles")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Rear toe (degrees)")).toHaveValue("0");
});
it("keeps legacy numeric zero specified in detail and Compare while unknown lengths stay missing", () => {
  const setup = {
    ...testSetup,
    data: {
      suspension: {
        front: {
          link_lengths: [
            { name: "upper_arm", length_mm: 0 },
            { name: "Custom unknown" },
          ],
        },
      },
    },
  };
  render(<TechnicalData data={setup.data} />);
  expect(screen.getByText("0 mm")).toBeVisible();
  expect(screen.getByText("Not specified")).toBeVisible();
  const other = {
    ...setup,
    data: {
      suspension: {
        front: {
          link_lengths: [
            { name: "Upper arm", length_mm: 1 },
            { name: "Custom unknown", length_mm: 0 },
          ],
        },
      },
    },
  };
  const differences = comparisonSections(setup, other, true);
  expect(differences).toHaveLength(1);
  expect(differences[0]!.rows).toEqual([
    expect.objectContaining({ label: "Upper arm (mm)", left: "0", right: "1" }),
  ]);
});
