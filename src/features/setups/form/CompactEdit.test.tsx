import { useEffect } from "react";
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
import { SetupForm } from "./SetupForm";
import { testSetup } from "../testFixtures";
import { serializePatch } from "./serialization";
import type { SetupFormValues } from "./formSchema";
const sample = {
  ...testSetup,
  data: {
    ...testSetup.data,
    running_gear: {
      front: { hex: { offset_mm: 0 }, wheel: { model: "界".repeat(200) } },
      rear: { tire: { model: "Partial" } },
    },
  },
};
function show() {
  const save = vi.fn<(v: SetupFormValues) => Promise<boolean>>(
    async () => false,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SetupForm
        setup={sample}
        pending={false}
        onSave={save}
        generalPhotos={<button type="button">Photo manager sentinel</button>}
      />
    </QueryClientProvider>,
  );
  return save;
}
const select = (label: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Setup sections" }),
    ).getByRole("button", { name: new RegExp("^" + label + "(?:\\s*·|$)") }),
  );
it("opens General with photos/title/chassis/notes/visibility in order; hides them without remounting on section switches", () => {
  show();
  const photo = screen.getByRole("button", { name: "Photo manager sentinel" });
  const title = screen.getByLabelText("Title"),
    notes = screen.getByLabelText("Notes"),
    visibility = screen.getByLabelText("Visibility");
  const follows = (a: Element, b: Element) =>
    expect(
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  follows(document.querySelector(".section-sidebar")!, photo);
  follows(photo, title);
  follows(title, screen.getByRole("button", { name: "Change chassis" }));
  follows(screen.getByRole("button", { name: "Change chassis" }), notes);
  follows(notes, visibility);
  expect(screen.getAllByLabelText("Title")).toHaveLength(1);
  fireEvent.change(notes, { target: { value: "Draft notes" } });
  select("Front");
  expect(title).not.toBeVisible();
  expect(photo).not.toBeVisible();
  fireEvent.change(screen.getByLabelText("Front camber (degrees)"), {
    target: { value: "-" },
  });
  select("General");
  expect(screen.getByRole("button", { name: "Photo manager sentinel" })).toBe(
    photo,
  );
  expect(notes).toHaveValue("Draft notes");
  select("Front");
  expect(screen.getByLabelText("Front camber (degrees)")).toHaveValue("-");
});
it("makes the summary a keyboard edit target and trash a separate named control", async () => {
  show();
  select("Wheels & tires");
  const user = userEvent.setup();
  const card = screen.getByRole("region", { name: "Front hex" });
  const edit = within(card).getByRole("button", { name: "Edit Front hex" });
  edit.focus();
  await user.keyboard("{Enter}");
  const offset = screen.getByLabelText("Front hex offset (mm)");
  expect(offset).toHaveValue("0");
  fireEvent.change(offset, { target: { value: "-" } });
  await user.click(
    screen.getByRole("button", { name: "Close Front hex editor" }),
  );
  expect(offset).not.toBeVisible();
  expect(offset).toHaveValue("-");
  const remove = within(card).getByRole("button", { name: "Remove Front hex" });
  expect(remove.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  await user.click(remove);
  expect(edit).toHaveAttribute("aria-expanded", "false");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(remove).toHaveFocus();
  await user.click(edit);
  expect(offset).toHaveValue("-");
  await user.click(screen.getByRole("button", { name: "Done Front hex" }));
  await waitFor(() => expect(offset).toHaveFocus());
  expect(offset).toHaveAttribute("aria-invalid", "true");
  fireEvent.change(offset, { target: { value: "0" } });
  await user.click(screen.getByRole("button", { name: "Done Front hex" }));
  expect(offset).not.toBeVisible();
});
it("offers one chooser for only absent components with axle context; close retains an empty editor", async () => {
  show();
  select("Wheels & tires");
  const user = userEvent.setup();
  expect(screen.getAllByRole("button", { name: "Add component" })).toHaveLength(
    1,
  );
  expect(screen.queryByLabelText("Front tire model")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add component" }));
  const choices = screen.getByRole("group", { name: "Available components" });
  expect(
    within(choices).queryByRole("button", { name: "Add Front hex" }),
  ).not.toBeInTheDocument();
  expect(
    within(choices).queryByRole("button", { name: "Add Rear differential" }),
  ).not.toBeInTheDocument();
  await user.click(
    within(choices).getByRole("button", { name: "Add Front tire" }),
  );
  const model = screen.getByLabelText("Front tire model");
  expect(model).toHaveValue("");
  expect(model).not.toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: "Close Front tire editor" }),
  );
  await user.click(screen.getByRole("button", { name: "Add component" }));
  expect(
    screen.queryByRole("button", { name: "Add Front tire" }),
  ).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Add component" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Edit Front tire" }));
  expect(model).toBeVisible();
});
it("preserves whole-document serialization, zeros, long and partial hidden summaries after editing General", async () => {
  const save = show();
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "General only" },
  });
  select("Wheels & tires");
  expect(screen.getByRole("region", { name: "Front hex" })).toHaveTextContent(
    "Offset (mm): 0",
  );
  expect(screen.getByRole("region", { name: "Front wheel" })).toHaveTextContent(
    "界".repeat(200),
  );
  select("General");
  await user.click(screen.getByRole("button", { name: "Save setup" }));
  expect(serializePatch(save.mock.calls[0]![0]).data).toEqual(sample.data);
});

it("explicit conflict reload resets technical editors without remounting the photo lifetime", async () => {
  const mount = vi.fn(),
    unmount = vi.fn();
  function Photos() {
    useEffect(() => {
      mount();
      return () => {
        unmount();
      };
    }, []);
    return <button type="button">Stable photo lifetime</button>;
  }
  const client = new QueryClient();
  const form = (version: number) => (
    <QueryClientProvider client={client}>
      <SetupForm
        setup={{ ...sample, title: version ? "Reloaded title" : sample.title }}
        resetVersion={version}
        onSave={vi.fn()}
        pending={false}
        generalPhotos={<Photos />}
      />
    </QueryClientProvider>
  );
  const view = render(form(0));
  const photo = screen.getByRole("button", { name: "Stable photo lifetime" });
  select("Front");
  fireEvent.change(screen.getByLabelText("Front toe (degrees)"), {
    target: { value: "-" },
  });
  view.rerender(form(1));
  expect(screen.getByLabelText("Title")).toHaveValue("Reloaded title");
  expect(photo).toBeVisible();
  expect(mount).toHaveBeenCalledOnce();
  expect(unmount).not.toHaveBeenCalled();
  select("Front");
  expect(screen.getByLabelText("Front toe (degrees)")).toHaveValue("0");
});
