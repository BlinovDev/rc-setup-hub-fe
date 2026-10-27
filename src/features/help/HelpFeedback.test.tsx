import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { routes } from "../../app/router";
import { server } from "../../test/server";
import { renderSetupRoute } from "../setups/testUtils";
import { HelpFeedback } from "./HelpFeedback";

const email = "internationaldrifthub@gmail.com";
function assertContent() {
  const dialog = screen.getByRole("dialog", { name: "Help & Feedback" });
  expect(dialog).toHaveAccessibleDescription(
    /creating or accessing an account/,
  );
  expect(dialog).toHaveTextContent(/technical support/);
  expect(dialog).toHaveTextContent(/report a bug/);
  expect(dialog).toHaveTextContent(/suggest a feature/);
  expect(dialog).toHaveTextContent(/ask something else/);
  expect(within(dialog).getByText(email)).toBeVisible();
  expect(
    within(dialog).getByRole("link", { name: "Send email" }),
  ).toHaveAttribute("href", `mailto:${email}`);
  expect(
    within(dialog).getByRole("button", { name: "Close help" }),
  ).toHaveFocus();
  return dialog;
}

it("opens by keyboard, exposes plain email/mailto, contains focus and restores the opener", async () => {
  render(<HelpFeedback />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Help & Feedback" });
  expect(trigger).toHaveAttribute("type", "button");
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = assertContent();
  expect(trigger).toHaveAttribute("aria-controls", dialog.id);
  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("link", { name: "Send email" }),
  ).toHaveFocus();
  await user.tab();
  expect(
    within(dialog).getByRole("button", { name: "Close help" }),
  ).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "Close help" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.keyboard(" ");
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("dismisses only a backdrop click, not text or panel padding", async () => {
  render(<HelpFeedback />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Help & Feedback" });
  await user.click(trigger);
  const dialog = assertContent();
  const bounds = vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 50,
    top: 50,
    right: 300,
    bottom: 300,
  } as DOMRect);
  await user.click(within(dialog).getByText(email));
  fireEvent.click(dialog, { clientX: 100, clientY: 100 });
  expect(dialog).toBeVisible();
  fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  bounds.mockRestore();
});

it("is available to guests in the mobile header and desktop footer without signing in", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/setups/search`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.get(
      `${apiUrl}/api/v1/me`,
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ["/"] })}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Sign in" });
  await screen.findByText("No public setups match these filters.");
  expect(
    within(
      screen.getByRole("navigation", { name: "Public navigation" }),
    ).getByRole("link", { name: "Explore" }),
  ).toBeInTheDocument();
  const user = userEvent.setup();
  for (const area of [
    screen.getByRole("banner"),
    screen.getByRole("contentinfo"),
  ]) {
    await user.click(
      within(area).getByRole("button", { name: "Help & Feedback" }),
    );
    assertContent();
    await user.click(screen.getByRole("button", { name: "Close help" }));
  }
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  view.unmount();
  client.clear();
});

it("reuses the signed-in footer and drawer, restoring help focus before account-menu dismissal", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
  renderSetupRoute("/my/setups");
  await screen.findByText("No setups yet.");
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("contentinfo")).getByRole("button", {
      name: "Help & Feedback",
    }),
  );
  assertContent();
  await user.click(screen.getByRole("button", { name: "Close help" }));
  const menuTrigger = screen.getByRole("button", { name: "Open account menu" });
  await user.click(menuTrigger);
  const menu = screen.getByRole("dialog", { name: "Account and navigation" });
  const help = within(menu).getByRole("button", { name: "Help & Feedback" });
  await user.click(help);
  const panel = assertContent();
  fireEvent(panel, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(help).toHaveFocus();
  expect(menu).toBeVisible();
  expect(within(menu).getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(within(menu).getAllByRole("link")).toHaveLength(3);
  await user.click(
    within(menu).getByRole("button", { name: "Close account menu" }),
  );
  expect(menuTrigger).toHaveFocus();
});
