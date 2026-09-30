import { createBrowserRouter, Link, type RouteObject } from "react-router";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">RC Setup Hub</h1>
        <p className="mt-4">Application foundation is ready.</p>
      </main>
    ),
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
