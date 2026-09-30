import type { components } from "../../api/generated/schema";
import { useLogout } from "./queries";

export function AuthenticatedShell({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const signOut = useLogout();
  return (
    <section className="mt-6" aria-label="Your session">
      <div className="flex items-center gap-3">
        {user.avatar_url && (
          <img
            className="h-12 w-12 rounded-full object-cover"
            src={user.avatar_url}
            alt=""
            width={48}
            height={48}
          />
        )}
        <p className="break-words">{user.nickname}</p>
      </div>
      {signOut.isError && (
        <p className="mt-4" role="alert">
          Sign out failed. Please try again.
        </p>
      )}
      <button
        className="mt-6 min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
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
      </button>
    </section>
  );
}
