import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./providers";
import { routes } from "./router";

function renderRoute(path: string) {
  render(
    <AppProviders>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path] })}
      />
    </AppProviders>,
  );
}

describe("application foundation", () => {
  it("renders the bootstrap shell", () => {
    renderRoute("/");
    expect(
      screen.getByRole("heading", { name: "RC Setup Hub" }),
    ).toBeInTheDocument();
  });

  it("provides a not-found route with working home navigation", async () => {
    renderRoute("/unknown");
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Return home" }));
    expect(
      screen.getByRole("heading", { name: "RC Setup Hub" }),
    ).toBeInTheDocument();
  });

  it("provides a query client to descendants", () => {
    function QueryConsumer() {
      const client = useQueryClient();
      return <p>{client ? "Query provider ready" : "Missing provider"}</p>;
    }
    render(
      <AppProviders>
        <QueryConsumer />
      </AppProviders>,
    );
    expect(screen.getByText("Query provider ready")).toBeInTheDocument();
  });
});
