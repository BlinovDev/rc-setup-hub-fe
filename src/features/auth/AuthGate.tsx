import type { ReactNode } from "react";
import { Link } from "react-router";
import type { components } from "../../api/generated/schema";
import { useQuery } from "@tanstack/react-query";
import { currentUserOptions } from "./queries";
import { LoginPage } from "./LoginPage";
import { AuthenticatedShell } from "./AuthenticatedShell";

export function AuthGate({
  children,
}: {
  children?: (user: components["schemas"]["User"]) => ReactNode;
}) {
  const session = useQuery(currentUserOptions);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">RC Setup Hub</h1>
      {session.isPending ? (
        <p className="mt-6" role="status">
          Checking your session…
        </p>
      ) : session.isError ? (
        <div className="mt-6">
          <p role="alert">Unable to check your session.</p>
          <button
            className="mt-4 min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            disabled={session.isFetching}
            onClick={() => void session.refetch()}
          >
            {session.isFetching ? "Checking…" : "Retry"}
          </button>
        </div>
      ) : session.data === null ? (
        <LoginPage />
      ) : (
        <>
          <nav className="mt-4 flex flex-wrap gap-4" aria-label="Main">
            <Link to="/">Home</Link>
            <Link to="/my/setups">My setups</Link>
            <Link to="/friends">Friends</Link>
            <Link to="/settings">Settings</Link>
          </nav>
          <AuthenticatedShell user={session.data} />
          {children?.(session.data)}
        </>
      )}
    </main>
  );
}
