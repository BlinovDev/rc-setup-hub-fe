import { createBrowserRouter, Link, type RouteObject } from "react-router";
import { AuthGate } from "../features/auth/AuthGate";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AuthGate />,
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
