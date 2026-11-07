import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import type { components } from "../../api/generated/schema";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "./testFixtures";
import { renderSetupRoute } from "./testUtils";
import { detailKey, usePatchSetup } from "./queries";
import { useCropPhoto, usePhotoActions } from "./photos/queries";
import { currentUserKey } from "../auth/queries";

type Setup = components["schemas"]["Setup"];
const path = `/setups/${testSetup.id}`;
function mockDetail(setup: Setup) {
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json(setup),
    ),
    http.get(`${apiUrl}/api/v1/users/:id`, () =>
      HttpResponse.json({
        ...testUser,
        public_setup_count: 1,
        member_since: testUser.created_at,
      }),
    ),
  );
}
it.each([
  [
    "pending",
    "Pending review",
    "Your setup is awaiting approval. You and your friends can view it, but it isn't visible publicly yet.",
  ],
  ["approved", "Approved", null],
  [
    "rejected",
    "Rejected",
    "Your setup wasn't approved and isn't publicly visible. You and your friends can still view it.",
  ],
] as const)(
  "owner public %s displays a compact accessible status below the title",
  async (moderation_status, label, explanation) => {
    mockDetail({ ...testSetup, visibility: "public", moderation_status });
    renderSetupRoute(path);
    const badge = await screen.findByRole("status", {
      name: "Moderation status",
    });
    expect(badge).toHaveTextContent(label);
    expect(
      screen.getByRole("group", { name: "Setup visibility and moderation" }),
    ).toContainElement(badge);
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    const title = screen.getByRole("heading", { name: testSetup.title });
    expect(
      title.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      badge.compareDocumentPosition(
        screen.getByRole("link", { name: "Edit setup" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    if (explanation) expect(screen.getByText(explanation)).toBeInTheDocument();
    else expect(screen.queryByText(/Your setup/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resubmit|appeal/i }),
    ).not.toBeInTheDocument();
  },
);
it.each(["private", "friends"] as const)(
  "owner %s hides moderation",
  async (visibility) => {
    mockDetail({ ...testSetup, visibility, moderation_status: "rejected" });
    renderSetupRoute(path);
    await screen.findByRole("heading", { name: testSetup.title });
    expect(
      screen.queryByRole("status", { name: "Moderation status" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Your setup/)).not.toBeInTheDocument();
  },
);
it.each(["pending", "approved", "rejected"] as const)(
  "authorized non-owner sees no %s owner information",
  async (moderation_status) => {
    mockDetail({
      ...testSetup,
      owner_id: testSetup.chassis_model_id!,
      visibility: "public",
      moderation_status,
    });
    renderSetupRoute(path);
    await screen.findByRole("heading", { name: testSetup.title });
    expect(
      screen.queryByRole("status", { name: "Moderation status" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Your setup/)).not.toBeInTheDocument();
  },
);

it.each(["upload", "delete", "cover", "crop"] as const)(
  "successful photo %s refreshes backend moderation and public projections",
  async (operation) => {
    let setup: Setup = { ...testSetup, visibility: "public" };
    mockDetail(setup);
    // Read the backend fixture anew on every refetch.
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
        HttpResponse.json(setup),
      ),
    );
    const endpoint = `${apiUrl}/api/v1/setups/${setup.id}/photos`;
    const mutate = () => {
      setup = { ...setup, moderation_status: "pending" };
      return operation === "delete"
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({}, { status: operation === "upload" ? 201 : 200 });
    };
    server.use(
      http.post(endpoint, mutate),
      http.delete(`${endpoint}/:photo`, mutate),
      http.put(`${endpoint}/:photo/cover`, mutate),
      http.put(`${endpoint}/:photo/crop`, mutate),
    );
    const { client } = renderSetupRoute(path);
    await screen.findByText("Approved");
    const projections = [
      ["setups", "search", "public"],
      ["setups", "user", testUser.id, "public"],
      ["setups", "compare", "result"],
      ["users", "public", testUser.id],
    ] as const;
    projections.forEach((key) => client.setQueryData(key, []));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hooks = renderHook(
      () => ({
        actions: usePhotoActions(setup.id, setup.owner_id),
        crop: useCropPhoto(setup.id, setup.owner_id),
      }),
      { wrapper },
    );
    await act(async () => {
      if (operation === "upload")
        await hooks.result.current.actions.upload.mutateAsync({
          file: new File(["image"], "car.jpg", { type: "image/jpeg" }),
          requestId: crypto.randomUUID(),
        });
      else if (operation === "crop")
        await hooks.result.current.crop.mutateAsync({
          photoId: "photo",
          body: { expected_revision: 0, crop: { x: 0, y: 0, size: 1 } },
        });
      else
        await hooks.result.current.actions.mutation.mutateAsync({
          photoId: "photo",
          remove: operation === "delete",
        });
    });
    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    expect(
      client.getQueryData<Setup>(detailKey(setup.id))?.moderation_status,
    ).toBe("pending");
    projections
      .slice(0, 3)
      .forEach((key) =>
        expect(client.getQueryState(key)?.isInvalidated).toBe(true),
      );
    expect(client.getQueryData(projections[3])).toMatchObject({
      public_setup_count: 1,
    });
  },
);

it("failed photo upload preserves Approved; text/technical edits use the returned unchanged status", async () => {
  mockDetail({ ...testSetup, visibility: "public" });
  server.use(
    http.post(`${apiUrl}/api/v1/setups/${testSetup.id}/photos`, () =>
      HttpResponse.json({ error: "Failed" }, { status: 500 }),
    ),
    http.patch(`${apiUrl}/api/v1/setups/${testSetup.id}`, async ({ request }) =>
      HttpResponse.json({
        ...testSetup,
        visibility: "public",
        ...((await request.json()) as object),
      }),
    ),
  );
  const { client } = renderSetupRoute(path);
  await screen.findByText("Approved");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hooks = renderHook(
    () => ({
      photos: usePhotoActions(testSetup.id, testUser.id),
      patch: usePatchSetup(testSetup.id),
    }),
    { wrapper },
  );
  await act(async () => {
    await expect(
      hooks.result.current.photos.upload.mutateAsync({
        file: new File(["image"], "car.jpg"),
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    await hooks.result.current.patch.mutateAsync({
      title: "Edited title",
      notes: "Edited notes",
      data: { suspension: { front: { toe_deg: 0 } } },
    });
  });
  expect(screen.getByText("Approved")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Edited title" }),
  ).toBeInTheDocument();
});

it.each([401, 403, 404])(
  "revoked %s access hides cached foreign detail and gallery",
  async (status) => {
    mockDetail({
      ...testSetup,
      owner_id: testSetup.chassis_model_id!,
      visibility: "public",
    });
    const { client } = renderSetupRoute(path);
    await screen.findByRole("heading", { name: testSetup.title });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, async () => {
        await blocked;
        return HttpResponse.json({ error: "Hidden" }, { status });
      }),
    );
    let refresh!: Promise<void>;
    act(() => {
      refresh = client.invalidateQueries({
        queryKey: detailKey(testSetup.id),
        exact: true,
      });
    });
    await screen.findByText("Loading setup…");
    expect(document.title).not.toContain(testSetup.title);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
    expect(screen.queryByText("Old note")).not.toBeInTheDocument();
    await act(async () => {
      release();
      await refresh;
    });
    expect(
      screen.queryByRole("heading", { name: testSetup.title }),
    ).not.toBeInTheDocument();
  },
);
it("logout discards owner status and setup cache before guest refetch", async () => {
  mockDetail({
    ...testSetup,
    visibility: "public",
    moderation_status: "pending",
  });
  const { client } = renderSetupRoute(path);
  await screen.findByText("Pending review");
  server.use(
    http.get(`${apiUrl}/api/v1/me`, () =>
      HttpResponse.json({ error: "Guest" }, { status: 401 }),
    ),
  );
  act(() => {
    client.setQueryData(currentUserKey, null);
  });
  await waitFor(() =>
    expect(screen.queryByText("Pending review")).not.toBeInTheDocument(),
  );
  expect(screen.queryByText(testSetup.title)).not.toBeInTheDocument();
  expect(client.getQueryData(detailKey(testSetup.id))).not.toMatchObject({
    moderation_status: "approved",
  });
});

it("public discovery and profile do not reuse owner pending/rejected cache entries", async () => {
  mockDetail({ ...testSetup, visibility: "public" });
  server.use(
    http.get(`${apiUrl}/api/v1/chassis/brands`, () => HttpResponse.json([])),
    http.get(`${apiUrl}/api/v1/setups/search`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.get(`${apiUrl}/api/v1/users/${testUser.id}/public-setups`, () =>
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
  );
  const { client, router } = renderSetupRoute(path);
  await screen.findByText("Approved");
  const hidden = ["pending", "rejected"].map((moderation_status) => ({
    ...testSetup,
    visibility: "public",
    moderation_status,
    title: `${moderation_status} owner-only setup`,
  }));
  client.setQueryData(["setups", "mine"], hidden);
  client.setQueryData(["setups", "user", testUser.id], hidden);
  await act(async () => {
    await router.navigate("/");
  });
  await screen.findByRole("heading", { name: "Explore" });
  expect(
    screen.queryByText("pending owner-only setup"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("rejected owner-only setup"),
  ).not.toBeInTheDocument();
  await act(async () => {
    await router.navigate(`/users/${testUser.id}`);
  });
  await screen.findByRole("heading", { name: testUser.nickname });
  expect(
    screen.queryByText("pending owner-only setup"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("rejected owner-only setup"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
});

it("keeps Approved while an upload is unconfirmed, then uses the refetched backend state", async () => {
  let setup: Setup = { ...testSetup, visibility: "public" };
  mockDetail(setup);
  let release!: () => void;
  const accepted = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  server.use(
    http.get(`${apiUrl}/api/v1/setups/${setup.id}`, () =>
      HttpResponse.json(setup),
    ),
    http.post(`${apiUrl}/api/v1/setups/${setup.id}/photos`, async () => {
      started = true;
      await accepted;
      setup = { ...setup, moderation_status: "pending" };
      return HttpResponse.json({}, { status: 201 });
    }),
  );
  const { client } = renderSetupRoute(path);
  await screen.findByText("Approved");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hooks = renderHook(() => usePhotoActions(setup.id, setup.owner_id), {
    wrapper,
  });
  let upload!: Promise<unknown>;
  act(() => {
    upload = hooks.result.current.upload.mutateAsync({
      file: new File(["image"], "car.jpg"),
      requestId: crypto.randomUUID(),
    });
  });
  await waitFor(() => expect(started).toBe(true));
  expect(screen.getByText("Approved")).toBeInTheDocument();
  expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
  await act(async () => {
    release();
    await upload;
  });
  expect(await screen.findByText("Pending review")).toBeInTheDocument();
});
