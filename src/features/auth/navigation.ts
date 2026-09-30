import { apiUrl } from "../../api/config";

export const googleLoginUrl = new URL("/auth/google", apiUrl).href;

// A small browser boundary lets tests verify navigation without starting OAuth.
export const browserNavigation = {
  assign: (url: string) => window.location.assign(url),
};

export function startGoogleLogin() {
  browserNavigation.assign(googleLoginUrl);
}
