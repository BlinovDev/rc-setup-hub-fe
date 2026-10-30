import { HelpFeedback } from "../help/HelpFeedback";
import { flushSync } from "react-dom";
import { SocialLinks } from "../../shared/social/SocialLinks";
import { Fragment, useState, useLayoutEffect, type ReactNode } from "react";
import { NavLink } from "react-router";
import type { components } from "../../api/generated/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../shared/components/Button";
import { InlineNotice, LoadingState } from "../../shared/components/Feedback";
import { currentUserKey, currentUserOptions } from "./queries";
import { watchSessionCache } from "./sessionCache";
import { LoginPage } from "./LoginPage";
import { RouteMetadata } from "../../app/RouteMetadata";
import { SignInButton } from "./SignInButton";
import { AuthenticatedShell } from "./AuthenticatedShell";
type User = components["schemas"]["User"];
type Props =
  | { publicPage: true; children: (user: User | null) => ReactNode }
  | { publicPage?: false; children?: (user: User) => ReactNode };

export function AuthGate(props: Props) {
  const client = useQueryClient();
  const [suspended, setSuspended] = useState(false);
  useLayoutEffect(() => watchSessionCache(client), [client]);
  useLayoutEffect(() => {
    // A restored document can otherwise retain a different tab's old identity.
    // Sanitize the BFCache snapshot before freezing, then resolve cookies anew.
    const hide = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      void client.cancelQueries({ queryKey: currentUserKey, exact: true });
      flushSync(() => {
        setSuspended(true);
        client.setQueryData(currentUserKey, null);
      });
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted)
        void client
          .resetQueries({ queryKey: currentUserKey, exact: true })
          .finally(() => setSuspended(false));
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [client]);
  const session = useQuery(currentUserOptions);
  const authenticated =
    !suspended && session.isSuccess && session.data !== null;
  return (
    <div className={authenticated ? "app-shell" : "app-shell guest-shell"}>
      <a href="#page-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <h1 className="app-title">RC Setup Hub</h1>
        {!suspended && session.isSuccess && session.data !== null && (
          <>
            <nav className="primary-nav desktop-primary-nav" aria-label="Main">
              <NavLink to="/" end>
                Explore
              </NavLink>
              <NavLink to="/my/setups">My setups</NavLink>
              <NavLink to="/friends">Friends</NavLink>
              <NavLink to="/settings">Settings</NavLink>
              <NavLink to="/compare">Compare</NavLink>
            </nav>
            <AuthenticatedShell user={session.data} />
          </>
        )}
        {!suspended && session.isSuccess && session.data === null && (
          <>
            <nav className="guest-nav" aria-label="Public navigation">
              <NavLink to="/" end>
                Explore
              </NavLink>
              <NavLink to="/my/setups/new">Create setup</NavLink>
              <NavLink to="/compare">Compare</NavLink>
            </nav>
            <div className="guest-header-controls">
              <SignInButton />
              <AuthenticatedShell user={null} />
            </div>
          </>
        )}
      </header>
      {(suspended || session.isPending || session.isError) && (
        <RouteMetadata unresolved />
      )}
      <main id="page-content" tabIndex={-1} className="page-content">
        {suspended || session.isPending ? (
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
        ) : (
          <Fragment key={session.data?.id ?? "guest"}>
            <RouteMetadata />
            {session.data ? (
              props.children?.(session.data)
            ) : props.publicPage ? (
              props.children(null)
            ) : (
              <LoginPage />
            )}
          </Fragment>
        )}
      </main>
      <nav
        className="primary-nav mobile-bottom-nav"
        aria-label="Mobile navigation"
      >
        <NavLink to="/" end>
          Explore
        </NavLink>
        {authenticated ? (
          <NavLink to="/my/setups">My setups</NavLink>
        ) : (
          <SignInButton>Sign up</SignInButton>
        )}
        <NavLink to="/compare">Compare</NavLink>
      </nav>
      <footer className="desktop-footer">
        {authenticated && <SocialLinks />}
        <HelpFeedback />
      </footer>
    </div>
  );
}
