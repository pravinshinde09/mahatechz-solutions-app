import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Linking } from "react-native";
import { api, ApiError } from "@/api/client";
import { keys, useLiveSession } from "@/api/queries";
import { Body, Button, Card, ErrorState, Heading, Loading, Screen, Title } from "@/components/ui";
import { formatLiveTime, formatTime } from "@/lib/format";
import { colors } from "@/theme/tokens";

/** Join opens Meet/Zoom in its app or the browser (spec §22.4); recordings open in the browser. */
export default function LiveSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: s, isLoading, error, refetch } = useLiveSession(id);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error || !s) return <ErrorState message={error?.message ?? "Class not found."} onRetry={refetch} />;

  const join = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { url } = await api<{ url: string }>(`/live-sessions/${id}/join`, { method: "POST" });
      // Linking hands the https link to the Meet/Zoom app when installed, else the browser.
      await Linking.openURL(url);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't open the class.");
      void queryClient.invalidateQueries({ queryKey: keys.liveSession(id) });
    } finally {
      setBusy(false);
    }
  };

  const watchRecording = async () => {
    try {
      const rec = await api<{ url: string }>(`/live-sessions/${id}/recording`);
      await WebBrowser.openBrowserAsync(rec.url);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't open the recording.");
    }
  };

  const upcoming = s.status === "SCHEDULED" || s.status === "LIVE";
  return (
    <Screen onRefresh={refetch}>
      <Stack.Screen options={{ title: s.course.title }} />
      <Title>{s.title}</Title>
      <Body muted>{formatLiveTime(s.startsAt, s.endsAt)}</Body>
      {s.host ? <Body muted small>With {s.host}</Body> : null}
      {s.status === "CANCELLED" ? (
        <Card style={{ borderColor: colors.warning }}>
          <Body>This class was cancelled{s.cancelReason ? `: ${s.cancelReason}` : "."}</Body>
        </Card>
      ) : null}
      {upcoming ? (
        s.joinOpen ? (
          <Button title="Join class" onPress={join} busy={busy} />
        ) : (
          <Card>
            <Body>The join link opens at {formatTime(s.joinOpensAt)} (30 minutes before the start). Pull down to refresh.</Body>
          </Card>
        )
      ) : null}
      {s.recording?.available ? <Button title="Watch recording" variant="outline" onPress={watchRecording} /> : null}
      {message ? <Body small style={{ color: colors.danger }}>{message}</Body> : null}
      {s.notesHtml ? (
        <>
          <Heading>Class notes</Heading>
          {/* Notes are short Markdown rendered by the API; shown as plain text here. */}
          <Body small>{s.notesHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}</Body>
        </>
      ) : null}
    </Screen>
  );
}
