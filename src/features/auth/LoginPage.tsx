import { startGoogleLogin } from "./navigation";

export function LoginPage() {
  return (
    <button
      className="mt-6 min-h-11 rounded bg-slate-800 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      type="button"
      onClick={startGoogleLogin}
    >
      Sign in with Google
    </button>
  );
}
