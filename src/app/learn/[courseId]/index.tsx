import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api, ApiError } from "@/api/client";
import { keys, useAnnouncements, useLearnCourse, useProgress, useResources, type LearnResource } from "@/api/queries";
import { Badge, Body, Button, Card, EmptyState, ErrorState, Heading, Loading, ProgressBar, Screen } from "@/components/ui";
import type { LearnCourse } from "@/contracts/learning";
import { openResource } from "@/features/resources";
import { formatBytes, formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";

const tabs = ["Lessons", "Resources", "Announcements", "Progress"] as const;
type Tab = (typeof tabs)[number];

const stateIcon = { completed: "checkmark-circle", in_progress: "ellipse-outline", available: "ellipse-outline", locked: "lock-closed-outline" } as const;
const stateColor = { completed: colors.success, in_progress: colors.cyan, available: colors.muted, locked: colors.muted } as const;
const stateText = { completed: "Completed", in_progress: "In progress", available: "Not started", locked: "Locked" } as const;

export default function SyllabusScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [tab, setTab] = useState<Tab>("Lessons");
  const { data, isLoading, error, refetch, isRefetching } = useLearnCourse(courseId);

  if (isLoading) return <Loading />;
  if (error || !data) {
    const message = error instanceof ApiError && error.code === "ENROLLMENT_REQUIRED" ? error.message : (error?.message ?? "Couldn't load the course.");
    return <ErrorState message={message} onRetry={refetch} />;
  }
  const required = data.modules.reduce((n, m) => n + m.requiredCount, 0);
  const done = data.modules.reduce((n, m) => n + m.completedRequiredCount, 0);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Stack.Screen options={{ title: data.course.title }} />
      <Card>
        <Body style={{ fontWeight: "600" }}>{data.course.title}</Body>
        <ProgressBar percent={data.enrollment?.progressPercent ?? 0} label="Course progress" />
        <Body muted small>
          {done} of {required} required lessons · {data.enrollment?.progressPercent ?? 0}%
        </Body>
        {data.resume ? <Button title="Continue" onPress={() => router.push(`/learn/${courseId}/${data.resume!.lessonId}`)} /> : null}
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="tablist">
        {tabs.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: space.md, borderRadius: 999, borderWidth: 1, borderColor: tab === t ? colors.primary : colors.border, backgroundColor: tab === t ? colors.surfaceRaised : "transparent" }}>
            <Text style={{ color: tab === t ? colors.foreground : colors.muted, fontWeight: "600" }}>
              {t}
              {t === "Announcements" && data.unreadAnnouncements ? ` • ${data.unreadAnnouncements}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "Lessons" ? <Lessons course={data} /> : tab === "Resources" ? <Resources courseId={courseId} /> : tab === "Announcements" ? <Announcements courseId={courseId} unread={data.unreadAnnouncements} /> : <Progress courseId={courseId} />}
    </Screen>
  );
}

function Lessons({ course }: { course: LearnCourse }) {
  return (
    <>
      {course.modules.map((m, i) => (
        <View key={m.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Heading style={{ flex: 1 }}>
              {i + 1}. {m.title}
            </Heading>
            <Body muted small style={{ fontFamily: "monospace" }}>
              {m.completedRequiredCount}/{m.requiredCount}
            </Body>
          </View>
          {m.lessons.map((l) => (
            <Pressable
              key={l.id}
              disabled={l.state === "locked"}
              onPress={() => router.push(`/learn/${course.course.id}/${l.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${l.title}, ${stateText[l.state]}`}
              style={({ pressed }) => ({ flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, minHeight: 56, borderRadius: radius.sm, backgroundColor: pressed ? colors.surfaceRaised : colors.surface, borderWidth: 1, borderColor: colors.border, opacity: l.state === "locked" ? 0.6 : 1 })}
            >
              <Ionicons name={stateIcon[l.state]} size={20} color={stateColor[l.state]} />
              <View style={{ flex: 1 }}>
                <Body small style={{ fontWeight: "500" }}>
                  {l.title}
                </Body>
                <Body muted small>
                  {[formatDuration(l.durationSeconds), !l.isRequired ? "Optional" : "", l.state === "in_progress" && l.percent ? `${l.percent}%` : "", l.availableAt ? `Opens ${formatDate(l.availableAt)}` : ""].filter(Boolean).join(" · ")}
                </Body>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}

function Resources({ courseId }: { courseId: string }) {
  const { data, isLoading, error, refetch } = useResources(courseId);
  const [message, setMessage] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load resources."} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No resources yet" description="Notes and practice files from your instructor appear here." />;
  const open = async (r: LearnResource) => {
    setMessage(null);
    try {
      await openResource(r);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't open the file.");
    }
  };
  // Daily notes timeline: newest class date first (the API already orders them).
  return (
    <>
      {message ? <Body small style={{ color: colors.danger }}>{message}</Body> : null}
      {data.map((r) => (
        <Card key={r.assignmentId} onPress={() => void open(r)} accessibilityLabel={`Open ${r.title}`}>
          <Body style={{ fontWeight: "600" }}>{r.title}</Body>
          <Body muted small>
            {[r.type === "LINK" ? "Link" : r.type.replace("_", " ").toLowerCase(), formatBytes(r.sizeBytes), r.classDate ? `Class of ${formatDate(r.classDate)}` : r.attachedTo].filter(Boolean).join(" · ")}
          </Body>
          {r.bestOnDesktop ? <Badge text={`Best on desktop${r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ""}`} tone="warning" /> : null}
        </Card>
      ))}
    </>
  );
}

function Announcements({ courseId, unread }: { courseId: string; unread: number }) {
  const { data, isLoading, error, refetch } = useAnnouncements(courseId);
  const queryClient = useQueryClient();
  // Opening the tab marks the course's announcements read.
  useEffect(() => {
    if (!unread) return;
    void api(`/learn/courses/${courseId}/announcements/read`, { method: "POST" }).then(() => queryClient.invalidateQueries({ queryKey: keys.learn(courseId) }));
  }, [courseId, unread, queryClient]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load announcements."} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No announcements yet" description="Course news from your instructor appears here." />;
  return (
    <>
      {data.map((a) => (
        <Card key={a.id}>
          <Body style={{ fontWeight: "600" }}>
            {!a.read ? "• " : ""}
            {a.title}
          </Body>
          <Body small>{a.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}</Body>
          <Body muted small>
            {formatDateTime(a.publishedAt)}
            {a.author ? ` · ${a.author}` : ""}
          </Body>
        </Card>
      ))}
    </>
  );
}

function Progress({ courseId }: { courseId: string }) {
  const { data, isLoading, error, refetch } = useProgress(courseId);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load progress."} onRetry={refetch} />;
  return (
    <>
      <Card>
        <Body style={{ fontWeight: "600" }}>Progress</Body>
        <Body muted small>
          Required lessons completed, checked by the server.
        </Body>
        {data.progress.modules.map((m) => (
          <View key={m.id} style={{ gap: 4 }}>
            <Body small>
              {m.title} · {m.completedRequired}/{m.required}
            </Body>
            <ProgressBar percent={m.percent} label={`${m.title} progress`} />
          </View>
        ))}
      </Card>
      {data.quizzes.length ? (
        <Card>
          <Body style={{ fontWeight: "600" }}>Quiz scores</Body>
          <Body muted small>
            Verified — graded on the server. Your best attempt counts.
          </Body>
          {data.quizzes.map((q) => (
            <Body key={q.id} small>
              {q.title}: {q.bestScorePercent === null ? "not taken" : `${q.bestScorePercent}%`}
              {q.passed ? " · passed" : ""}
            </Body>
          ))}
        </Card>
      ) : null}
      {data.requirements.unmet.length || data.certificate.enabled ? (
        <Card>
          <Body style={{ fontWeight: "600" }}>{data.requirements.unmet.length ? "Still to do" : "Certificate"}</Body>
          {data.requirements.unmet.map((u) => (
            <Body key={u.code} small muted>
              • {u.message}
            </Body>
          ))}
          {data.certificate.enabled ? (
            data.certificate.id ? (
              <Button title="View your certificate" variant="outline" onPress={() => router.push("/certificates")} />
            ) : (
              <Body small muted>
                {data.progress.completedAt ? "Your certificate is being prepared — we'll email you when it's issued." : "This course awards a certificate when you complete it."}
              </Body>
            )
          ) : null}
        </Card>
      ) : null}
      <Card>
        <Body style={{ fontWeight: "600" }}>Activity</Body>
        <Body muted small>
          Indicative only — it can be off if the app stayed open or the network dropped.
        </Body>
        <Body small>Video watched: {formatDuration(data.activity.videoSecondsWatched) || "—"}</Body>
        <Body small>Lessons opened: {data.activity.lessonsOpened}</Body>
        <Body small>Live class joins: {data.activity.liveJoinClicks}</Body>
      </Card>
    </>
  );
}
