import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Screen, TextField, Title } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong. Please try again.");

/** Passwordless (ADR 0009 in the API repo): an emailed one-time code, or Google. */
export default function SignInScreen() {
  const { sendCode, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"code" | "google" | null>(null);

  const emailCode = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter your email address.");
    setBusy("code");
    try {
      await sendCode(email);
      router.push({ pathname: "/verify-code", params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={s.brand}>
          <Title>
            Mahatecz <Title style={{ color: colors.primary }}>Learning</Title>
          </Title>
          <Body muted>AutoCAD Electrical, Revit MEP and electrical design — learn on the go.</Body>
        </View>
        <Button title="Continue with Google" variant="outline" onPress={google} busy={busy === "google"} disabled={busy === "code"} />
        <Body muted small style={{ textAlign: "center" }}>
          or use your email
        </Body>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          hint="We'll email you a one-time sign-in code. No password needed."
          onSubmitEditing={emailCode}
        />
        {error ? (
          <Body small style={{ color: colors.danger }}>
            {error}
          </Body>
        ) : null}
        <Button title="Email me a code" onPress={emailCode} busy={busy === "code"} disabled={busy === "google"} />
        <View style={s.links}>
          <Link href="/register" style={s.link}>
            New here? Create an account
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  brand: { marginTop: space.xxl * 2, marginBottom: space.lg, gap: space.sm },
  links: { flexDirection: "row", justifyContent: "center", marginTop: space.sm },
  link: { color: colors.primary, fontSize: 15, paddingVertical: space.sm },
});
