import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Screen, TextField, Title } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? (err.code === "RATE_LIMITED" ? "Too many attempts. Please wait a few minutes." : err.message) : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
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
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        {error ? (
          <Body small style={{ color: colors.danger }}>
            {error}
          </Body>
        ) : null}
        <Button title="Sign in" onPress={submit} busy={busy} />
        <View style={s.links}>
          <Link href="/forgot-password" style={s.link}>
            Forgot password?
          </Link>
          <Link href="/register" style={s.link}>
            Create an account
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  brand: { marginTop: space.xxl * 2, marginBottom: space.lg, gap: space.sm },
  links: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  link: { color: colors.primary, fontSize: 15, paddingVertical: space.sm },
});
