import { useCallback, useId, useRef, useState } from "react";
import { NavigationDrawer } from "../../shared/components/NavigationDrawer";
import { SocialLinks } from "../../shared/social/SocialLinks";
import { InlineNotice } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import type { components } from "../../api/generated/schema";
import { useLogout } from "./queries";

export function AuthenticatedShell({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const signOut = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const identity = (
    <div className="flex items-center gap-3">
      {user.avatar_url && (
        <img
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          src={user.avatar_url}
          alt=""
          width={32}
          height={32}
        />
      )}
      <p className="min-w-0 break-words text-sm">{user.nickname}</p>
    </div>
  );
  const signOutControl = (
    <>
      {signOut.isError && (
        <InlineNotice tone="error" className="mt-4">
          Sign out failed. Please try again.
        </InlineNotice>
      )}
      <Button
        className="session-signout"
        type="button"
        disabled={signOut.isPending}
        aria-busy={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        {signOut.isPending
          ? "Signing out…"
          : signOut.isError
            ? "Try again"
            : "Sign out"}
      </Button>
    </>
  );
  return (
    <>
      <section
        className="session-control desktop-session"
        aria-label="Your session"
      >
        {identity}
        {signOutControl}
      </section>
      <div className="mobile-session">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        )}
        <Button
          ref={triggerRef}
          aria-label="Open account menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </Button>
      </div>
      <NavigationDrawer
        id={menuId}
        open={menuOpen}
        onClose={closeMenu}
        triggerRef={triggerRef}
        identity={identity}
        footer={
          <>
            <SocialLinks />
            {signOutControl}
          </>
        }
      />
    </>
  );
}
