import type { ReactNode } from "react";
import { Button } from "../../shared/components/Button";
import { startGoogleLogin } from "./navigation";

export function SignInButton({
  children = "Sign in",
}: {
  children?: ReactNode;
}) {
  return <Button onClick={startGoogleLogin}>{children}</Button>;
}
