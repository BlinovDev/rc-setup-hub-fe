import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { renderSetupRoute } from "../setups/testUtils";
import { testUser } from "../setups/testFixtures";

// jsdom lacks native dialog focus/inertness; shim only the open/close boundary.
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLButtonElement>("button")?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
  server.use(
    http.get(`${apiUrl}/api/v1/me/setups`, () => HttpResponse.json([])),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

async function openMenu() {
  renderSetupRoute("/my/setups");
  await screen.findByText("No setups yet.");
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Open account menu" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const mobileHeader = trigger.parentElement!;
  expect(
    within(mobileHeader).queryByText(testUser.nickname),
  ).not.toBeInTheDocument();
  expect(
    within(mobileHeader).queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Account and navigation" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(trigger).toHaveAttribute("aria-controls", dialog.id);
  return { user, trigger, dialog };
}

it("shows identity, canonical safe icon links and sign out without moving bottom navigation", async () => {
  const { dialog } = await openMenu();
  expect(within(dialog).getByText(testUser.nickname)).toBeInTheDocument();
  const expected = [
    ["YouTube", "https://youtube.com/@InternatIonal_drift_hub/videos"],
    ["TikTok", "https://tiktok.com/@internationaldrif"],
    ["Instagram", "https://www.instagram.com/internationaldrifthub/"],
  ];
  for (const area of [dialog, screen.getByRole("contentinfo")]) {
    for (const [name, url] of expected) {
      const link = within(area).getByRole("link", {
        name: `${name} (opens in a new tab)`,
      });
      expect(link).toHaveAttribute("href", url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  }
  const links = within(dialog).getByRole("navigation");
  const signOut = within(dialog).getByRole("button", { name: "Sign out" });
  expect(
    links.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    within(dialog).queryByRole("navigation", { name: "Main" }),
  ).not.toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "Main" });
  for (const name of ["Home", "My setups", "Friends", "Settings"])
    expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
});

it("focuses Close, supports explicit dismissal and native Escape cancellation, and restores focus", async () => {
  const { user, trigger, dialog } = await openMenu();
  const close = within(dialog).getByRole("button", {
    name: "Close account menu",
  });
  expect(close).toHaveFocus();
  await user.tab();
  expect(within(dialog).getByRole("link", { name: /YouTube/ })).toHaveFocus();
  await user.click(close);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("preserves pending, failure, retry and successful session removal from the drawer", async () => {
  let attempts = 0;
  server.use(
    http.post(`${apiUrl}/api/v1/auth/logout`, async ({ request }) => {
      expect(request.credentials).toBe("include");
      attempts++;
      await delay(60);
      return attempts === 1
        ? HttpResponse.json({}, { status: 500 })
        : new HttpResponse(null, { status: 204 });
    }),
  );
  const { user, dialog } = await openMenu();
  await user.click(within(dialog).getByRole("button", { name: "Sign out" }));
  expect(
    within(dialog).getByRole("button", { name: "Signing out…" }),
  ).toBeDisabled();
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Sign out failed. Please try again.",
  );
  await user.click(within(dialog).getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("button", { name: "Sign in with Google" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(attempts).toBe(2);
});

it("closes on switching to desktop and removes its media listener", async () => {
  let listener: (() => void) | undefined;
  const media = {
    matches: false,
    addEventListener: vi.fn((_event, callback) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  const { trigger } = await openMenu();
  media.matches = true;
  act(() => listener?.());
  await waitFor(() =>
    expect(trigger).toHaveAttribute("aria-expanded", "false"),
  );
  vi.unstubAllGlobals();
});
