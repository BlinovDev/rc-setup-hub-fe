import type { ReactNode } from "react";
import { NavLink } from "react-router";
import type { components } from "../../api/generated/schema";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../shared/components/Button";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { currentUserOptions } from "./queries";
import { LoginPage } from "./LoginPage";
import { AuthenticatedShell } from "./AuthenticatedShell";
export function AuthGate({
  children,
}: {
  children?: (user: components["schemas"]["User"]) => ReactNode;
}) {
  const session = useQuery(currentUserOptions);
  const authenticated = session.isSuccess && session.data !== null;
  return (
    <div className={authenticated ? "app-shell" : "app-shell guest-shell"}>
      <a href="#page-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <h1 className="app-title">RC Setup Hub</h1>
        {session.isSuccess && session.data !== null && (
          <>
            <nav className="primary-nav" aria-label="Main">
              <NavLink to="/" end>
                Home
              </NavLink>
              <NavLink to="/my/setups">My setups</NavLink>
              <NavLink to="/friends">Friends</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </nav>
            <AuthenticatedShell user={session.data} />
          </>
        )}
      </header>
      <main id="page-content" tabIndex={-1} className="page-content">
        {session.isPending ? (
          <LoadingState>Checking your session…</LoadingState>
        ) : session.isError ? (
          <InlineNotice tone="error">
            Unable to check your session.
            <Button
              variant="primary"
              disabled={session.isFetching}
              onClick={() => void session.refetch()}
            >
              {session.isFetching ? "Checking…" : "Retry"}
            </Button>
          </InlineNotice>
        ) : session.data === null ? (
          <LoginPage />
        ) : (
          children?.(session.data)
        )}
      </main>
    </div>
  );
}
