import { Button } from "../../shared/components/Button";
import { startGoogleLogin } from "./navigation";

export function LoginPage() {
  return (
    <section className="login-panel">
      <h2 className="text-xl font-semibold">Sign in to RC Setup Hub</h2>
      <p>Manage and share your RC drift setups.</p>
      <Button
        variant="primary"
        className="w-full"
        type="button"
        onClick={startGoogleLogin}
      >
        Sign in with Google
      </Button>
    </section>
  );
}
