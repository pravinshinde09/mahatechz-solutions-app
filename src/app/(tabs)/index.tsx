import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useDashboard } from "@/api/queries";
import { useAuth } from "@/auth/auth-context";
import { Badge, Body, Button, Card, EmptyState, ErrorState, Heading, Loading, ProgressBar, Screen, Title } from "@/components/ui";
import { formatLiveTime } from "@/lib/format";
import { colors, space } from "@/theme/tokens";

/** "My learning" (spec §22.4): continue learning, enrolled courses with progress, live classes. */
export default function MyLearningScreen() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useDashboard();

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load your courses."} onRetry={refetch} />;

  const active = data.courses.filter((c) => c.status === "ACTIVE");
  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Title>Hello, {user?.fullName.split(" ")[0]}</Title>
      {data.pendingPayments.length ? (
        <Card style={{ borderColor: colors.primary }}>
          <Body small>Your payment for {data.pendingPayments[0]!.courseTitle} is being verified. You&apos;ll get access as soon as it&apos;s approved.</Body>
        </Card>
      ) : null}

      {data.continueLearning ? (
        <Card style={s.continue} onPress={() => router.push(`/learn/${data.continueLearning!.courseId}/${data.continueLearning!.lessonId}`)} accessibilityLabel={`Continue ${data.continueLearning.lessonTitle}`}>
          <Body small style={{ color: colors.cyan, fontWeight: "600" }}>
            CONTINUE LEARNING
          </Body>
          <Heading>{data.continueLearning.lessonTitle}</Heading>
          <Body muted small>
            {data.continueLearning.courseTitle}
          </Body>
          {data.continueLearning.percent > 0 ? <ProgressBar percent={data.continueLearning.percent} label="Lesson progress" /> : null}
          <Body style={{ color: colors.primary, fontWeight: "600" }}>{data.continueLearning.positionSeconds > 0 ? "Resume ▶" : "Start ▶"}</Body>
        </Card>
      ) : null}

      <Heading>My courses</Heading>
      {data.courses.length ? (
        (active.length ? active : data.courses).map((c) => (
          <Card key={c.enrollmentId} onPress={c.status === "ACTIVE" ? () => router.push(`/learn/${c.course.id}`) : undefined} accessibilityLabel={c.course.title}>
            <View style={s.row}>
              <Body style={{ flex: 1, fontWeight: "600" }} numberOfLines={2}>
                {c.course.title}
              </Body>
              <Body small style={{ fontFamily: "monospace" }}>
                {c.progressPercent}%
              </Body>
            </View>
            <ProgressBar percent={c.progressPercent} label={`${c.course.title} progress`} />
            <Body muted small>
              {c.completedAt ? "Completed" : c.status !== "ACTIVE" ? "Access ended — renew on the website" : c.nextLesson ? `Next: ${c.nextLesson.title}` : "All lessons done"}
            </Body>
          </Card>
        ))
      ) : (
        // Consumption-only (spec §23.10): describe that enrolment happens on the website, no link.
        <EmptyState title="No courses yet" description="Courses you enrol in on our website appear here automatically. Pull down to refresh after enrolling." action={<Button title="Browse courses" variant="outline" onPress={() => router.push("/discover")} />} />
      )}

      <Heading>Upcoming live classes</Heading>
      {data.upcomingLive.length ? (
        data.upcomingLive.map((l) => (
          <Card key={l.id} onPress={() => router.push(`/live/${l.id}`)} accessibilityLabel={l.title}>
            <View style={s.row}>
              <Body style={{ flex: 1, fontWeight: "600" }}>{l.title}</Body>
              {l.joinOpen ? <Badge text="Join open" tone="danger" /> : null}
            </View>
            <Body muted small>
              {l.courseTitle} · {formatLiveTime(l.startsAt, l.endsAt)}
            </Body>
          </Card>
        ))
      ) : (
        <Body muted small>
          No live classes in the next 7 days.
        </Body>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  continue: { borderColor: colors.primary, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
});
