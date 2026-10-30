import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api, ApiError, setSession, WEB_URL } from "@/api/client";
import { useNotifications } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Body, Button, Card, Heading, Screen } from "@/components/ui";
import { colors, space } from "@/theme/tokens";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: notifications } = useNotifications();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [busy, setBusy] = useState(false);

  // Store policy: accounts can be deleted from inside the app (spec §22.4, §18.4). The API asks for
  // a sign-in from the last 15 minutes ("re-authenticate"); otherwise the user signs in again first.
  const requestDeletion = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/me/deletion-request", { method: "POST", body: { confirm: true } });
      const done = () => void setSession(null);
      if (Platform.OS === "web") done();
      else Alert.alert("Deletion requested", "Your account will be deleted in 14 days. Sign in before then to cancel.", [{ text: "OK", onPress: done }]);
    } catch (err) {
      setReauth(err instanceof ApiError && err.code === "REAUTHENTICATION_REQUIRED");
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
            {error ? (
              <Body small style={{ color: colors.danger }}>
                {error}
              </Body>
            ) : null}
            {reauth ? (
              <Button title="Sign out to sign in again" variant="outline" onPress={() => void signOut()} />
            ) : (
              <Button title="Delete my account" variant="danger" onPress={requestDeletion} busy={busy} />
            )}
            <Button title="Cancel" variant="ghost" onPress={() => setDeleting(false)} />
          </>
        ) : (
          <Button title="Delete my account…" variant="danger" onPress={() => setDeleting(true)} />
        )}
      </View>
    </Screen>
  );
}
