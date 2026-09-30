import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http, HttpResponse } from "msw";
import { afterEach, expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { ChassisSelector } from "./ChassisSelector";
import { selectedChassisModelId, type ChassisSelection } from "./selection";

const yokomo = "c61393b6-daa0-4eb8-923c-57aedbb46a46";
const mst = "c61393b6-daa0-4eb8-923c-57aedbb46a47";
const rd = "c61393b6-daa0-4eb8-923c-57aedbb46a48";
const brands = [
  { id: yokomo, name: "Yokomo" },
  { id: mst, name: "MST" },
] satisfies components["schemas"]["ChassisBrand"][];
const models = [
  { id: rd, name: "RD2.0" },
] satisfies components["schemas"]["ChassisModel"][];
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function Harness() {
  const [value, setValue] = useState<ChassisSelection>({
    brandId: null,
    modelId: null,
  });
  return (
    <>
      <ChassisSelector value={value} onChange={setValue} />
      <output aria-label="Selection">{JSON.stringify(value)}</output>
      <output aria-label="Persisted model">
        {String(selectedChassisModelId(value))}
      </output>
    </>
  );
}
function setup() {
  const client = new QueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}
function catalog() {
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json(brands);
    }),
  );
}
it("renders active brands and Custom without requesting models", async () => {
  catalog();
  setup();
  await screen.findByRole("option", { name: "Yokomo" });
  expect(screen.getByRole("combobox", { name: "Brand" })).toHaveValue("");
  expect(
    screen.queryByRole("combobox", { name: "Model" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent("null");
});
it("loads exact brand models, clears incompatible models immediately, and maps Custom to null", async () => {
  catalog();
  server.use(
    http.get(
      `${apiUrl}/api/v1/chassis/brands/:brand/models`,
      async ({ params, request }) => {
        expect(request.credentials).toBe("include");
        expect([yokomo, mst]).toContain(params.brand);
        await delay(50);
        return HttpResponse.json(
          params.brand === yokomo
            ? models
            : [{ id: "c61393b6-daa0-4eb8-923c-57aedbb46a49", name: "RMX" }],
        );
      },
    ),
  );
  setup();
  await screen.findByRole("option", { name: "Yokomo" });
  const events = userEvent.setup();
  await events.selectOptions(screen.getByLabelText("Brand"), yokomo);
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent(
    "undefined",
  );
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("Loading models");
  await screen.findByRole("option", { name: "RD2.0" });
  await events.selectOptions(screen.getByLabelText("Model"), rd);
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent(rd);
  await events.selectOptions(screen.getByLabelText("Brand"), mst);
  expect(screen.getByLabelText("Model")).toHaveValue("");
  expect(
    screen.queryByRole("option", { name: "RD2.0" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent(
    "undefined",
  );
  await screen.findByRole("option", { name: "RMX" });
  await events.selectOptions(screen.getByLabelText("Brand"), "");
  expect(screen.getByLabelText("Selection")).toHaveTextContent(
    '{"brandId":null,"modelId":null}',
  );
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent("null");
});
it("shows loading and empty brands", async () => {
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, async () => {
      await delay(50);
      return HttpResponse.json([]);
    }),
  );
  setup();
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("Loading brands");
  expect(
    await screen.findByText("No active brands available."),
  ).toBeInTheDocument();
});
it.each(["server", "network"])(
  "supports retry after brands %s failure",
  async (failure) => {
    let calls = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/chassis/brands`, () => {
        calls++;
        if (calls > 1) return HttpResponse.json(brands);
        return failure === "network"
          ? HttpResponse.error()
          : HttpResponse.json({ error: "Internal details" }, { status: 500 });
      }),
    );
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load brands.",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry brands" }));
    await screen.findByRole("option", { name: "Yokomo" });
    expect(calls).toBe(2);
  },
);
it("keeps an empty brand selected without falling back to Custom", async () => {
  catalog();
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands/:brand/models`, () =>
      HttpResponse.json([]),
    ),
  );
  setup();
  await screen.findByRole("option", { name: "Yokomo" });
  await userEvent.setup().selectOptions(screen.getByLabelText("Brand"), yokomo);
  expect(
    await screen.findByText("No active models for this brand."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Brand")).toHaveValue(yokomo);
  expect(screen.getByLabelText("Persisted model")).toHaveTextContent(
    "undefined",
  );
});
it.each([404, 500])(
  "handles model %s without presenting an empty list and supports retry",
  async (status) => {
    catalog();
    let calls = 0;
    server.use(
      http.get(`${apiUrl}/api/v1/chassis/brands/:brand/models`, () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ error: "Internal details" }, { status })
          : HttpResponse.json(models);
      }),
    );
    setup();
    await screen.findByRole("option", { name: "Yokomo" });
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText("Brand"), yokomo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 404
        ? "This brand is no longer available"
        : "Unable to load models",
    );
    expect(
      screen.queryByText("No active models for this brand."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeDisabled();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry models" }));
    await screen.findByRole("option", { name: "RD2.0" });
  },
);
