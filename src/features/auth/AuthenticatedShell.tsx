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
  return (
    <section className="session-control" aria-label="Your session">
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
    </section>
  );
}
