import { useQuery } from "@tanstack/react-query";
import { currentUserOptions } from "./queries";
import { LoginPage } from "./LoginPage";
import { AuthenticatedShell } from "./AuthenticatedShell";

export function AuthGate() {
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
        <AuthenticatedShell user={session.data} />
      )}
    </main>
  );
}
