import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api, ApiError, setSession, WEB_URL } from "@/api/client";
import { useNotifications } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Card, Heading, Screen, TextField } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: notifications } = useNotifications();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Store policy: accounts can be deleted from inside the app (spec §22.4, §18.4).
  const requestDeletion = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/me/deletion-request", { method: "POST", body: { password } });
      const done = () => void setSession(null);
      if (Platform.OS === "web") done();
      else Alert.alert("Deletion requested", "Your account will be deleted in 14 days. Sign in before then to cancel.", [{ text: "OK", onPress: done }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Heading>{user?.fullName}</Heading>
        <Body muted small>
          {user?.email}
        </Body>
        {!user?.emailVerified ? <Body small style={{ color: colors.warning }}>Please verify your email — check your inbox.</Body> : null}
      </Card>

      <Button title={`Notifications${notifications?.unreadCount ? ` (${notifications.unreadCount})` : ""}`} variant="outline" onPress={() => router.push("/notifications")} />
      <Button title="Certificates" variant="outline" onPress={() => router.push("/certificates")} />
      {/* Profile edits, support and payments live on the website for now. */}
      <Button title="Account & support on the website" variant="outline" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/app/settings`)} />
      <Button title="Sign out" variant="outline" onPress={() => void signOut()} />

      <View style={{ marginTop: space.xl, gap: space.md }}>
        <Heading>Delete account</Heading>
        {deleting ? (
          <>
            <Body muted small>
              Your account is deleted 14 days after you ask; signing in before then cancels it. Payment and certificate records are kept as required by law.
            </Body>
            <TextField label="Your password" value={password} onChangeText={setPassword} secureTextEntry error={error} />
            <Button title="Delete my account" variant="danger" onPress={requestDeletion} busy={busy} disabled={!password} />
            <Button title="Cancel" variant="ghost" onPress={() => setDeleting(false)} />
          </>
        ) : (
          <Button title="Delete my account…" variant="danger" onPress={() => setDeleting(true)} />
        )}
      </View>
    </Screen>
  );
}
