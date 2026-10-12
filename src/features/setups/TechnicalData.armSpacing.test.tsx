import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { TechnicalData } from "./TechnicalData";
import { testSetup } from "./testFixtures";

it("keeps legacy detail free of default arm blocks", () => {
  render(<TechnicalData data={testSetup.data} />);
  expect(
    screen.queryByRole("heading", { name: /arm spacing/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("10.5T")).toBeInTheDocument();
});
it("omits null/empty blocks and unknown positions while displaying all-zero totals", () => {
  render(
    <TechnicalData
      data={{
        suspension: {
          front: {
            top_arm_spacing: { front_mm: 0, rear_mm: 0 },
            lower_arm_spacing: { front_mm: null, rear_mm: 5.2 },
          },
          rear: { top_arm_spacing: null, lower_arm_spacing: {} },
        },
      }}
    />,
  );
  const top = screen
    .getByRole("heading", { name: "Front top arm spacing" })
    .closest("section")!;
  expect(within(top).getAllByText("0 mm")).toHaveLength(2);
  const lower = screen
    .getByRole("heading", { name: "Front lower arm spacing" })
    .closest("section")!;
  expect(
    within(lower).queryByText("Front spacers (ahead of arm):"),
  ).not.toBeInTheDocument();
  expect(within(lower).getByText("5.2 mm")).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Rear top arm spacing" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Rear lower arm spacing" }),
  ).not.toBeInTheDocument();
});
it("spacing-only empty documents still show the empty-data message", () => {
  render(
    <TechnicalData
      data={{
        suspension: {
          front: { top_arm_spacing: { front_mm: null, rear_mm: null } },
        },
      }}
    />,
  );
  expect(screen.getByText("No technical setup data yet.")).toBeInTheDocument();
});
