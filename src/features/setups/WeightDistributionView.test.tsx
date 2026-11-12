import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WeightDistributionView } from "./WeightDistributionView";

it("maps all four corners and derives total, percentages and conditions", () => {
  render(
    <WeightDistributionView
      value={{
        front_left_g: 380,
        front_right_g: 400,
        rear_left_g: 320,
        rear_right_g: 350,
        body_installed: true,
        battery_installed: false,
      }}
    />,
  );
  const diagram = screen.getByRole("img", {
    name: /Top-down line drawing of a passenger car/,
  });
  expect(diagram.getAttribute("src")).toContain("weight-distribution-car.png");
  expect(screen.getByText("FL").parentElement).toHaveTextContent("380 g");
  expect(screen.getByText("FR").parentElement).toHaveTextContent("400 g");
  expect(screen.getByText("RL").parentElement).toHaveTextContent("320 g");
  expect(screen.getByText("RR").parentElement).toHaveTextContent("350 g");
  expect(screen.getByText(/1,?450 g/)).toBeInTheDocument();
  expect(screen.getByText("53.8%")).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: "Front to Rear balance" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: "Left to Right balance" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Body:/).parentElement).toHaveTextContent(
    "Body: Installed",
  );
  expect(screen.getByText(/Battery:/).parentElement).toHaveTextContent(
    "Battery: Not installed",
  );
});

it("hides absent measurements", () => {
  const { container } = render(<WeightDistributionView />);
  expect(container).toBeEmptyDOMElement();
});
