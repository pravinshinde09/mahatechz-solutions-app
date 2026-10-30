import { Redirect } from "expo-router";

/**
 * Google sign-in returns to mahatecz://auth-callback. The in-app browser hands that URL to
 * auth-context.tsx; if Android also delivers it as a deep link, this route just goes home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
