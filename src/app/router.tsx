import { ComparePage } from "../features/compare/ComparePage";
import { createBrowserRouter, Link, type RouteObject } from "react-router";
import { AuthGate } from "../features/auth/AuthGate";

import { SettingsPage } from "../features/profile/SettingsPage";

import { MySetupsPage } from "../features/setups/MySetupsPage";
import { NewSetupPage } from "../features/setups/NewSetupPage";
import { EditSetupPage } from "../features/setups/EditSetupPage";

import { DiscoveryPage } from "../features/search/DiscoveryPage";
import { SetupDetailPage } from "../features/setups/SetupDetailPage";

import { FriendsPage } from "../features/friendships/FriendsPage";

import { UserProfilePage } from "../features/users/UserProfilePage";

export const routes: RouteObject[] = [
  {
    path: "/compare",
    element: (
      <AuthGate publicPage>
        {(user) => <ComparePage viewer={user?.id ?? "guest"} />}
      </AuthGate>
    ),
  },
  {
    path: "/",
    element: <AuthGate publicPage>{() => <DiscoveryPage />}</AuthGate>,
  },
  {
    path: "/setups/:setupId",
    element: (
      <AuthGate publicPage>
        {(user) => <SetupDetailPage user={user} />}
      </AuthGate>
    ),
  },
  {
    path: "/users/:userId",
    element: <AuthGate publicPage>{() => <UserProfilePage />}</AuthGate>,
  },
  {
    path: "/friends",
    element: <AuthGate>{() => <FriendsPage />}</AuthGate>,
  },
  {
    path: "/settings",
    element: <AuthGate>{(user) => <SettingsPage user={user} />}</AuthGate>,
  },
  {
    path: "/my/setups",
    element: <AuthGate>{() => <MySetupsPage />}</AuthGate>,
  },
  {
    path: "/my/setups/new",
    element: <AuthGate>{() => <NewSetupPage />}</AuthGate>,
  },
  {
    path: "/my/setups/:setupId/edit",
    element: <AuthGate>{(user) => <EditSetupPage user={user} />}</AuthGate>,
  },
  {
    path: "*",
    element: (
      <AuthGate publicPage>
        {() => (
          <section className="mx-auto max-w-3xl px-6 py-12">
            <h1 className="text-3xl font-semibold">Page not found</h1>
            <Link className="mt-4 inline-block underline" to="/">
              Return home
            </Link>
          </section>
        )}
      </AuthGate>
    ),
  },
];

export const router = createBrowserRouter(routes);
