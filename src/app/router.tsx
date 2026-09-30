import { createBrowserRouter, Link, type RouteObject } from "react-router";
import { AuthGate } from "../features/auth/AuthGate";

import { SettingsPage } from "../features/profile/SettingsPage";

import { MySetupsPage } from "../features/setups/MySetupsPage";
import { NewSetupPage } from "../features/setups/NewSetupPage";
import { EditSetupPage } from "../features/setups/EditSetupPage";

import { DiscoveryPage } from "../features/search/DiscoveryPage";
import { SetupDetailPage } from "../features/setups/SetupDetailPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AuthGate>{() => <DiscoveryPage />}</AuthGate>,
  },
  {
    path: "/setups/:setupId",
    element: <AuthGate>{(user) => <SetupDetailPage user={user} />}</AuthGate>,
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
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <Link className="mt-4 inline-block underline" to="/">
          Return home
        </Link>
      </main>
    ),
  },
];

export const router = createBrowserRouter(routes);
