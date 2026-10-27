import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ApiError, publicApi } from "@/api/client";
import { Body, Button, Card, Heading, Screen, TextField } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErrors({});
    setMessage(null);
    if (!accept) return setErrors({ acceptTerms: "Please accept the terms to continue." });
    setBusy(true);
    try {
      await publicApi("/auth/register", { method: "POST", body: { fullName: fullName.trim(), email: email.trim().toLowerCase(), password, acceptTerms: true } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields: Record<string, string> = {};
        for (const d of err.details ?? []) fields[d.path.replace(/^body\./, "")] ??= d.issue;
        setErrors(fields);
        setMessage(err.message);
      } else setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <Card>
          <Heading>Check your email</Heading>
          <Body muted>We sent a verification link to {email.trim()}. Open it, then sign in here.</Body>
        </Card>
        <Button title="Back to sign in" onPress={() => router.replace("/sign-in")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" error={errors.fullName} hint="As it should appear on your certificates." />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={errors.password} hint="At least 10 characters." />
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
