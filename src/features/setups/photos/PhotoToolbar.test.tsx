import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PhotoToolbar } from "./PhotoToolbar";

it.each(["loading", "unavailable"] as const)(
  "does not claim empty saved capacity when photo count is %s",
  (countStatus) => {
    render(
      <PhotoToolbar
        count={0}
        saved
        disabled
        accept=".jpg"
        onSelect={vi.fn()}
        countStatus={countStatus}
      />,
    );
    expect(
      screen.queryByText("0/10 photo slots used (saved and queued)."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Load saved photos before adding more. Photo changes save immediately.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Choose photos" }),
    ).toBeDisabled();
  },
);

it("opens information on hover, keyboard focus and tap; dismisses with Escape, outside pointer and focus departure", async () => {
  const user = userEvent.setup();
  render(
    <>
      <PhotoToolbar
        count={0}
        saved={false}
        disabled={false}
        accept=".jpg"
        onSelect={vi.fn()}
      />
      <button>Outside</button>
    </>,
  );
  const trigger = screen.getByRole("button", {
    name: "Photo information",
  });
  const panel = () =>
    screen.queryByRole("region", { name: "Photo information details" });
  expect(panel()).not.toBeInTheDocument();
  fireEvent.mouseEnter(trigger.parentElement!);
  expect(panel()).toHaveTextContent("25 MiB");
  fireEvent.mouseLeave(trigger.parentElement!);
  expect(panel()).not.toBeInTheDocument();
  await user.tab();
  await user.tab();
  expect(trigger).toHaveFocus();
  expect(panel()).toHaveTextContent("Create setup saves your setup once");
  await user.keyboard("{Escape}");
  expect(panel()).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  expect(panel()).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Close photo information" }),
  );
  expect(panel()).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Outside" }));
  expect(panel()).not.toBeInTheDocument();
  await user.click(trigger);
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Close photo information" }),
  ).toHaveFocus();
  await user.tab();
  expect(panel()).not.toBeInTheDocument();
});

it("uses unique hidden multi-select inputs, a non-submit paperclip and leaves count/capacity visible", async () => {
  const onSelect = vi.fn();
  render(
    <>
      <PhotoToolbar
        count={1}
        saved
        disabled={false}
        accept=".jpg,.heic"
        onSelect={onSelect}
      />
      <PhotoToolbar
        count={10}
        saved={false}
        disabled
        accept=".jpg"
        onSelect={vi.fn()}
      />
    </>,
  );
  const inputs = screen.getAllByLabelText("Photo files", { selector: "input" });
  expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
  expect(inputs[0]!).toHaveAttribute("hidden");
  expect(inputs[0]!).toHaveAttribute("multiple");
  expect(inputs[1]!).toBeDisabled();
  const button = screen.getAllByRole("button", { name: "Choose photos" })[0]!;
  expect(button).toHaveAttribute("type", "button");
  const click = vi.spyOn(inputs[0]!, "click");
  await userEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
  const file = new File(["bytes"], "car.jpg", { type: "image/jpeg" });
  fireEvent.change(inputs[0]!, { target: { files: [file] } });
  expect(onSelect).toHaveBeenCalledWith([file]);
  expect(inputs[0]!).toHaveValue("");
  expect(
    screen.getByText("1/10 photo slots used (saved and queued)."),
  ).toBeVisible();
  expect(screen.getByText(/9 photo slots remaining/)).toBeVisible();
  await userEvent.click(
    screen.getAllByRole("button", {
      name: "Photo information",
    })[0]!,
  );
  expect(screen.getByRole("region")).toHaveTextContent(
    "Setup fields use Save setup separately",
  );
});
