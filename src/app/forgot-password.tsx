import { useState } from "react";
import { ApiError, publicApi } from "@/api/client";
import { Body, Button, Card, Screen, TextField } from "@/components/ui";

/** The reset link opens on the website; the new password then works here too. */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await publicApi("/auth/password/forgot", { method: "POST", body: { email: email.trim().toLowerCase() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {sent ? (
        <Card>
          <Body>If an account exists for {email.trim()}, we&apos;ve emailed a link to reset your password.</Body>
        </Card>
      ) : (
        <>
          <Body muted>Enter your email and we&apos;ll send you a reset link.</Body>
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
          <Button title="Send reset link" onPress={submit} busy={busy} />
        </>
      )}
    </Screen>
  );
}
