import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Card, Screen, TextField } from "@/components/ui";
import { colors } from "@/theme/tokens";

/** Second step of sign-in: the code from the email. Success switches the app to the signed-in stack. */
export default function VerifyCodeScreen() {
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const { sendCode, verifyCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);

  const verify = async () => {
    setError(null);
    if (!/^\d{6,10}$/.test(code.trim())) return setError("Enter the code from the email.");
    setBusy("verify");
    try {
      await verifyCode(email, code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy("resend");
    try {
      await sendCode(email);
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Card>
        <Body>
          We sent a sign-in code to <Body style={{ fontWeight: "600" }}>{email}</Body>. It expires in an hour; check your spam folder if it
          doesn&apos;t arrive.
        </Body>
      </Card>
      <TextField
        label="Sign-in code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        autoFocus
        error={error}
        onSubmitEditing={verify}
      />
      {notice ? (
        <Body small style={{ color: colors.success }}>
          {notice}
        </Body>
      ) : null}
      <Button title="Sign in" onPress={verify} busy={busy === "verify"} disabled={busy === "resend"} />
      <Button title="Send a new code" variant="ghost" onPress={resend} busy={busy === "resend"} disabled={busy === "verify"} />
    </Screen>
  );
}
