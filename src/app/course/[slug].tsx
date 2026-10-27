import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useCourse } from "@/api/queries";
import { Body, Button, Card, ErrorState, Heading, Loading, Screen, Title } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { colors, space } from "@/theme/tokens";

/**
 * Course details. Google Play payments policy (spec §23.10): the app is consumption-only — it
 * may say enrolment happens on the website, but shows no price, buy button or purchase link.
 */
export default function CourseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: c, isLoading, error, refetch } = useCourse(slug);
  if (isLoading) return <Loading />;
  if (error || !c) return <ErrorState message={error?.message ?? "Course not found."} onRetry={refetch} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: c.title }} />
      <Title>{c.title}</Title>
      {c.subtitle ? <Body muted>{c.subtitle}</Body> : null}
      <Body muted small>
        {[c.category.name, `${c.lessonCount} lessons`, formatDuration(c.durationMinutes * 60), c.instructors.join(", ")].filter(Boolean).join(" · ")}
      </Body>

      {c.viewer.isEnrolled ? (
        <Button title="Go to course" onPress={() => router.push(`/learn/${c.id}`)} />
      ) : (
        <Card>
          <Body>{c.viewer.enrollmentStatus === "PENDING" ? "Your enrolment is being verified. You'll find the course in My learning once it's approved." : "You can enrol in this course on our website. Once enrolled, it appears in My learning here."}</Body>
        </Card>
      )}

      {c.learningObjectives.length ? (
        <View style={{ gap: space.sm }}>
          <Heading>What you&apos;ll learn</Heading>
          {c.learningObjectives.map((o) => (
            <Body key={o} small>
              • {o}
            </Body>
          ))}
        </View>
      ) : null}

      <Heading>Syllabus</Heading>
      {c.syllabus.map((m, i) => (
        <Card key={m.id}>
          <Body small muted>
            Module {i + 1}
          </Body>
          <Body style={{ fontWeight: "600" }}>{m.title}</Body>
          {m.lessons.map((l) => (
            <Body key={l.id} small style={{ color: l.isPreview ? colors.primary : colors.foreground }}>
              {l.title}
              {l.durationSeconds ? ` · ${formatDuration(l.durationSeconds)}` : ""}
              {l.isPreview ? " · preview" : ""}
            </Body>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
