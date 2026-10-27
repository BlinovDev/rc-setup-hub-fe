import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import type { ReactNode } from "react";
import { server } from "../../test/server";
import { apiUrl } from "../../api/config";
import { testSetup, testUser } from "../setups/testFixtures";
import { currentUserKey } from "../auth/queries";
import { useDeleteRelationship } from "../friendships/queries";
import { useComparison } from "./queries";
it("accepted-friend removal resets comparison scope and cancels a late old authorized result", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(currentUserKey, testUser);
  let calls = 0,
    release!: () => void;
  const old = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.get(`${apiUrl}/api/v1/setups/compare`, async () => {
      calls++;
      if (calls === 1) {
        await old;
        return HttpResponse.json({
          left: testSetup,
          right: { ...testSetup, id: testUser.id },
        });
      }
      return new HttpResponse(null, { status: 404 });
    }),
    http.delete(
      `${apiUrl}/api/v1/friendships/friendship`,
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      pair: useComparison(testSetup.id, testUser.id, testUser.id, true),
      remove: useDeleteRelationship("friendship", testUser.id, true, () => {}),
    }),
    { wrapper },
  );
  await waitFor(() => expect(calls).toBe(1));
  await act(async () => {
    await view.result.current.remove.mutateAsync();
  });
  await waitFor(() => expect(view.result.current.pair.isError).toBe(true));
  release();
  await act(async () => {
    await old;
  });
  expect(view.result.current.pair.data).toBeUndefined();
  expect(calls).toBe(2);
  view.unmount();
  client.clear();
});
