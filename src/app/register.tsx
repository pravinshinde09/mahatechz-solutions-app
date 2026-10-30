import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Screen, TextField } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

/** Sign-up is sign-in with a name: the code confirms the email and creates the account. */
export default function RegisterScreen() {
  const { sendCode } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!accept) next.acceptTerms = "Please accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await sendCode(email, fullName);
      router.push({ pathname: "/verify-code", params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" error={errors.fullName} hint="As it should appear on your certificates." />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} hint="We'll email you a code to confirm it. No password needed." />
      <Pressable onPress={() => setAccept((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: accept }} style={{ flexDirection: "row", gap: space.md, alignItems: "center", minHeight: 44 }}>
        <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: accept ? colors.primary : colors.borderInput, backgroundColor: accept ? colors.primary : "transparent" }} />
        <Text style={{ color: colors.foreground, flex: 1 }}>I accept the terms of use and privacy policy.</Text>
      </Pressable>
      {errors.acceptTerms ? <Body small style={{ color: colors.danger }}>{errors.acceptTerms}</Body> : null}
      {message ? <Body small style={{ color: colors.danger }}>{message}</Body> : null}
      <Button title="Create account" onPress={submit} busy={busy} />
    </Screen>
  );
}
