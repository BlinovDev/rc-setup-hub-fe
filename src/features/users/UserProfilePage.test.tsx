import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, expect, it } from "vitest";
import { apiUrl } from "../../api/config";
import { server } from "../../test/server";
import { testSetup, testUser } from "../setups/testFixtures";
import { renderSetupRoute } from "../setups/testUtils";
import { detailKey } from "../setups/queries";
import { mockList, emptyList } from "../friendships/testUtils";
beforeEach(() => mockList(emptyList()));
const id = testSetup.chassis_model_id;
const profile = {
  id,
  nickname: "Other driver",
  avatar_url: "https://example.test/owner.png",
};
const profileUrl = `${apiUrl}/api/v1/users/${id}`;
const listUrl = `${profileUrl}/setups`;
function mockProfile() {
  server.use(
    http.get(profileUrl, ({ request }) => {
      expect(request.credentials).toBe("include");
      return HttpResponse.json(profile);
    }),
  );
}
it("invalid UUID makes neither profile nor list requests", async () => {
  let calls = 0;
  server.use(
    http.get(`${apiUrl}/api/v1/users/:id`, () => {
      calls++;
      return HttpResponse.json(profile);
    }),
    http.get(`${apiUrl}/api/v1/users/:id/setups`, () => {
      calls++;
      return HttpResponse.json([]);
    }),
  );
  renderSetupRoute("/users/not-a-uuid");
  await screen.findByText("User not found or unavailable.");
  expect(calls).toBe(0);
});
it.each([400, 404])(
  "profile %s is unavailable and never requests setups",
  async (status) => {
    let lists = 0;
    server.use(
      http.get(profileUrl, () =>
        HttpResponse.json({ error: "Private internals" }, { status }),
      ),
      http.get(listUrl, () => {
        lists++;
        return HttpResponse.json([]);
      }),
    );
    renderSetupRoute(`/users/${id}`);
    await screen.findByText("User not found or unavailable.");
    expect(lists).toBe(0);
    expect(screen.queryByText("Private internals")).not.toBeInTheDocument();
  },
);
it.each([500, "network"])(
  "profile %s retries before loading visible setups",
  async (failure) => {
    let profiles = 0,
      lists = 0;
    server.use(
      http.get(profileUrl, () => {
        profiles++;
        return profiles > 1
          ? HttpResponse.json(profile)
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json({ error: "Secret" }, { status: 500 });
      }),
      http.get(listUrl, () => {
        lists++;
        return HttpResponse.json([]);
      }),
    );
    renderSetupRoute(`/users/${id}`);
    await screen.findByRole("button", { name: "Retry profile" });
    expect(lists).toBe(0);
    expect(screen.queryByText("No visible setups.")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry profile" }));
    await screen.findByText("No visible setups.");
    expect(lists).toBe(1);
  },
);
it("sequences profile then list, reuses public cache, and shows a safe empty list", async () => {
  let resolved = false;
  server.use(
    http.get(profileUrl, async () => {
      await delay(60);
      resolved = true;
      return HttpResponse.json(profile);
    }),
    http.get(listUrl, async ({ request }) => {
      expect(resolved).toBe(true);
      expect(request.credentials).toBe("include");
      await delay(60);
      return HttpResponse.json([]);
    }),
  );
  const { client } = renderSetupRoute(`/users/${id}`);
  await screen.findByText("Loading profile…");
  await screen.findByText("Loading visible setups…");
  await screen.findByText("No visible setups.");
  expect(
    screen.getByRole("heading", { name: profile.nickname }),
  ).toBeInTheDocument();
  expect(document.querySelector("img")).toHaveAttribute(
    "src",
    profile.avatar_url,
  );
  expect(client.getQueryData(["users", "public", id])).toEqual(profile);
  expect(screen.queryByText(testUser.email)).not.toBeInTheDocument();
});
it.each(["unrelated", "friend", "owner"])(
  "renders exactly returned setups for %s without permission queries, N+1 or detail seeding",
  async (viewer) => {
    const ownerId = viewer === "owner" ? testUser.id : id;
    const returned = [
      "public",
      ...(viewer !== "unrelated" ? ["friends"] : []),
      ...(viewer === "owner" ? ["private"] : []),
    ].map((visibility, index) => ({
      ...testSetup,
      id: `c61393b6-daa0-4eb8-923c-57aedbb46a7${index}`,
      owner_id: ownerId,
      title: `${visibility} setup`,
      visibility,
      ...(index === 0 ? { chassis: null, chassis_model_id: null } : {}),
    }));
    server.use(
      http.get(`${apiUrl}/api/v1/users/${ownerId}`, () =>
        HttpResponse.json({ ...profile, id: ownerId, avatar_url: null }),
      ),
      http.get(`${apiUrl}/api/v1/users/${ownerId}/setups`, () =>
        HttpResponse.json(returned),
      ),
    );
    const { client, router } = renderSetupRoute(`/users/${ownerId}`);
    await screen.findByText("public setup");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(returned.length);
    expect(screen.getByText("Custom / not listed")).toBeInTheDocument();
    if (returned.length > 1)
      expect(screen.getAllByText("Historical Yokomo RD2.0")).toHaveLength(
        returned.length - 1,
      );
    for (const setup of returned) {
      expect(screen.getByRole("link", { name: setup.title })).toHaveAttribute(
        "href",
        `/setups/${setup.id}`,
      );
      expect(client.getQueryData(detailKey(setup.id))).toBeUndefined();
    }
    expect(
      screen.queryByText(/hidden|not friends|would see more/i),
    ).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/users/${ownerId}`);
    server.use(
      http.get(`${apiUrl}/api/v1/setups/${returned[0]!.id}`, () =>
        HttpResponse.json(returned[0]),
      ),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "public setup" }));
    await screen.findByRole("button", { name: "Copy link" });
  },
);
it.each([400, 500, "network"])(
  "visible-list %s keeps profile visible and retries independently",
  async (failure) => {
    mockProfile();
    let calls = 0;
    server.use(
      http.get(listUrl, () => {
        calls++;
        return calls > 1
          ? HttpResponse.json([])
          : failure === "network"
            ? HttpResponse.error()
            : HttpResponse.json(
                { error: "Secret" },
                { status: Number(failure) },
              );
      }),
    );
    renderSetupRoute(`/users/${id}`);
    await screen.findByRole("button", { name: "Retry visible setups" });
    expect(
      screen.getByRole("heading", { name: profile.nickname }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No visible setups.")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry visible setups" }));
    await screen.findByText("No visible setups.");
    expect(calls).toBe(2);
  },
);
it.each(["profile", "list"])(
  "%s 401 clears existing session and protected profile",
  async (endpoint) => {
    mockProfile();
    server.use(
      http.get(endpoint === "profile" ? profileUrl : listUrl, () =>
        HttpResponse.json({ error: "Expired" }, { status: 401 }),
      ),
    );
    renderSetupRoute(`/users/${id}`);
    await screen.findByRole("button", { name: "Sign in with Google" });
    expect(
      screen.queryByRole("heading", { name: profile.nickname }),
    ).not.toBeInTheDocument();
  },
);
it("uses a fresh public-profile cache without a duplicate owner request", async () => {
  mockProfile();
  server.use(http.get(listUrl, () => HttpResponse.json([])));
  const { client, router } = renderSetupRoute(`/users/${id}`);
  await screen.findByText("No visible setups.");
  let calls = 0;
  server.use(
    http.get(profileUrl, () => {
      calls++;
      return HttpResponse.json(profile);
    }),
    http.get(`${apiUrl}/api/v1/setups/${testSetup.id}`, () =>
      HttpResponse.json({ ...testSetup, owner_id: id }),
    ),
  );
  await act(async () => {
    await router.navigate(`/setups/${testSetup.id}`);
  });
  await screen.findByRole("link", { name: profile.nickname });
  expect(calls).toBe(0);
  expect(client.getQueryData(["users", "public", id])).toEqual(profile);
  await waitFor(() =>
    expect(
      screen.getByRole("link", { name: profile.nickname }),
    ).toHaveAttribute("href", `/users/${id}`),
  );
});
