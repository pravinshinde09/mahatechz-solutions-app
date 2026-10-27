import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api, ApiError } from "@/api/client";
import { keys, useLesson } from "@/api/queries";
import { Body, Button, Card, ErrorState, Loading, Screen, Title } from "@/components/ui";
import type { Playback, ProgressUpdate } from "@/contracts/learning";
import { ArticleView, EmbedVideoPlayer, ExternalPlayer, NativeVideoPlayer } from "@/features/player";
import { colors, space } from "@/theme/tokens";

/** Lesson player (spec §22.4). Progress always comes back from the server. */
export default function LessonScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const queryClient = useQueryClient();
  const { data: lesson, isLoading, error, refetch } = useLesson(lessonId);
  const playback = useQuery({ queryKey: ["playback", lessonId], queryFn: () => api<Playback>(`/lessons/${lessonId}/playback`), enabled: !!lesson?.hasPlayback, staleTime: 0 });
  const [started, setStarted] = useState<{ watchSessionId: string | null; resumeAt: number; firstOpenedAt: number | null } | null>(null);
  // Server answers from this screen's own events; until then the lesson's stored progress applies.
  const [update, setUpdate] = useState<ProgressUpdate | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lesson?.tracked) return;
    let cancelled = false;
    void api<{ watchSessionId: string | null; resumeAt: number; firstOpenedAt: string | null }>(`/lessons/${lesson.id}/progress/start`, { method: "POST", body: { client: "mobile" } })
      .then((r) => !cancelled && setStarted({ watchSessionId: r.watchSessionId, resumeAt: r.resumeAt, firstOpenedAt: r.firstOpenedAt ? Date.parse(r.firstOpenedAt) : null }))
      .catch(() => !cancelled && setStarted({ watchSessionId: null, resumeAt: lesson.progress.lastPositionSeconds, firstOpenedAt: null }));
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  if (isLoading || (lesson?.hasPlayback && playback.isLoading)) return <Loading />;
  if (error || !lesson) return <ErrorState message={error?.message ?? "Lesson not found."} onRetry={refetch} />;

  const session = lesson.tracked ? started : { watchSessionId: null, resumeAt: 0, firstOpenedAt: null };
  const completed = update?.completed || lesson.progress.state === "completed";
  const percent = update?.lessonPercent ?? lesson.progress.percent;

  const onUpdate = (u: ProgressUpdate) => {
    setUpdate(u);
    if (u.justCompleted) {
      setCelebrate(u.courseCompleted ? "Course complete — congratulations!" : "Lesson complete");
      void queryClient.invalidateQueries({ queryKey: keys.learn(courseId) });
      void queryClient.invalidateQueries({ queryKey: keys.dashboard });
    }
  };

  const markComplete = async () => {
    setBusy(true);
    setMessage(null);
    try {
      onUpdate(await api<ProgressUpdate>(`/lessons/${lesson.id}/complete`, { method: "POST" }));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const p = playback.data;
  const tracked = { lessonId: lesson.id, watchSessionId: session?.watchSessionId ?? null, resumeAt: session?.resumeAt ?? p?.resumeAt ?? 0, onUpdate };
  const stage =
    !session ? (
      <Loading />
    ) : p && (p.kind === "file" || p.kind === "hls") ? (
      <NativeVideoPlayer url={p.url} {...tracked} />
    ) : p?.kind === "embed" ? (
      <EmbedVideoPlayer url={p.url} {...tracked} />
    ) : p?.kind === "external" ? (
      <ExternalPlayer url={p.url} />
    ) : lesson.articleHtml ? (
      <ArticleView html={lesson.articleHtml} />
    ) : (
      <Card>
        <Body muted>{lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT" ? "Quizzes and assignments open soon." : lesson.type === "RESOURCE" ? "Open the files for this lesson from the course's Resources tab." : "The video for this lesson is still being prepared."}</Body>
      </Card>
    );

  const eligibleAt = session?.firstOpenedAt ? session.firstOpenedAt + lesson.completion.minElapsedSeconds * 1000 : 0;
  const manual = lesson.completion.mode === "manual" || lesson.completion.mode === "resource";

  return (
    <Screen>
      <Stack.Screen options={{ title: lesson.moduleTitle }} />
      <Title>{lesson.title}</Title>
      {stage}
      {celebrate ? (
        <Card style={{ borderColor: colors.success }}>
          <Body style={{ color: colors.success, fontWeight: "600" }}>{celebrate}</Body>
          {lesson.nextLessonId ? <Button title="Next lesson" onPress={() => router.replace(`/learn/${courseId}/${lesson.nextLessonId}`)} /> : null}
        </Card>
      ) : null}
      {lesson.tracked ? (
        <Card>
          {completed ? (
            <Body style={{ color: colors.success, fontWeight: "600" }}>✓ Completed</Body>
          ) : lesson.completion.mode === "video" ? (
            <Body muted small>
              Completes automatically at {lesson.completion.videoPercent}% watched — {percent}% so far.
            </Body>
          ) : manual ? (
            <>
              <Button title="Mark as complete" onPress={markComplete} busy={busy} />
              {eligibleAt > now ? <Body muted small>Spend a little more time on this lesson first — about {Math.ceil((eligibleAt - now) / 60_000)} min.</Body> : null}
            </>
          ) : (
            <Body muted small>Your instructor marks this lesson complete.</Body>
          )}
          {message ? <Body small style={{ color: colors.danger }}>{message}</Body> : null}
        </Card>
      ) : (
        <Body muted small>Staff preview — progress isn&apos;t recorded.</Body>
      )}
      <View style={{ flexDirection: "row", gap: space.md }}>
        {lesson.prevLessonId ? <Button title="‹ Previous" variant="outline" style={{ flex: 1 }} onPress={() => router.replace(`/learn/${courseId}/${lesson.prevLessonId}`)} /> : null}
        {lesson.nextLessonId ? <Button title="Next ›" variant="outline" style={{ flex: 1 }} onPress={() => router.replace(`/learn/${courseId}/${lesson.nextLessonId}`)} /> : null}
      </View>
      {lesson.descriptionHtml ? <Body muted small>{lesson.descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}</Body> : null}
      <Button title="Syllabus & resources" variant="ghost" onPress={() => router.push(`/learn/${courseId}`)} />
    </Screen>
  );
}
