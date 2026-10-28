import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, ApiError } from "@/api/client";
import { keys, useQuiz } from "@/api/queries";
import { Badge, Body, Button, Card, ErrorState, Heading, Loading } from "@/components/ui";
import type { Answer, Attempt } from "@/contracts/assessment";
import { colors, radius, space } from "@/theme/tokens";

type Given = { optionIds: string[]; numericValue: number | null; numericText: string };
const AUTOSAVE_MS = 1500;

const fromAttempt = (a: Attempt | null): Record<string, Given> =>
  Object.fromEntries((a?.answers ?? []).map((x) => [x.questionId, { optionIds: x.optionIds, numericValue: x.numericValue, numericText: x.numericValue === null ? "" : String(x.numericValue) }]));
const answered = (g: Given | undefined) => !!g && (g.optionIds.length > 0 || g.numericValue !== null);
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** QUIZ lesson in the app (spec §15.7): server-graded; answers save as you go and the server enforces time. */
export function QuizPanel({ lessonId, courseId, tracked }: { lessonId: string; courseId: string; tracked: boolean }) {
  const queryClient = useQueryClient();
  const overview = useQuiz(lessonId);
  const openId = overview.data?.openAttemptId ?? null;
  const resumed = useQuery({ queryKey: ["attempt", openId], queryFn: () => api<Attempt>(`/quiz-attempts/${openId}`), enabled: !!openId });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [edits, setEdits] = useState<Record<string, Given>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editsRef = useRef(edits);
  const submitting = useRef(false);

  const current = attempt ?? resumed.data ?? null;
  const base = fromAttempt(current);
  const given = (id: string) => edits[id] ?? base[id];
  const deadline = current?.deadlineAt ? Date.parse(current.deadlineAt) : null;
  const inProgress = current?.status === "IN_PROGRESS";

  const allAnswers = (): Answer[] => {
    const merged = { ...fromAttempt(current), ...editsRef.current };
    return Object.entries(merged).map(([questionId, g]) => ({ questionId, optionIds: g.optionIds, numericValue: g.numericValue }));
  };

  const flush = async () => {
    if (!current || !dirty.current.size) return;
    const ids = [...dirty.current];
    dirty.current.clear();
    setSaving("saving");
    try {
      await api(`/quiz-attempts/${current.id}/answers`, { method: "PUT", body: { answers: ids.map((id) => ({ questionId: id, optionIds: editsRef.current[id]!.optionIds, numericValue: editsRef.current[id]!.numericValue })) } });
      setSaving("saved");
    } catch {
      ids.forEach((id) => dirty.current.add(id));
      setSaving("error");
    }
  };

  const submit = async () => {
    if (!current || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      const result = await api<Attempt>(`/quiz-attempts/${current.id}/submit`, { method: "POST", body: { answers: allAnswers() } });
      setAttempt(result);
      void queryClient.invalidateQueries({ queryKey: keys.quiz(lessonId) });
      void queryClient.invalidateQueries({ queryKey: keys.learn(courseId) });
      void queryClient.invalidateQueries({ queryKey: keys.lesson(lessonId) });
      void queryClient.invalidateQueries({ queryKey: keys.dashboard });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!inProgress || deadline === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) {
        clearInterval(id);
        void submit();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `submit` reads refs; the clock must not restart every render
  }, [inProgress, deadline]);

  const update = (questionId: string, g: Given) => {
    const next = { ...editsRef.current, [questionId]: g };
    editsRef.current = next;
    setEdits(next);
    dirty.current.add(questionId);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await api<Attempt>(`/quizzes/${lessonId}/attempts`, { method: "POST" });
      editsRef.current = {};
      setEdits({});
      setAttempt(a);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the quiz.");
    } finally {
      setBusy(false);
    }
  };

  if (overview.isLoading || resumed.isLoading) return <Loading />;
  if (overview.error || !overview.data) return <ErrorState message={overview.error?.message ?? "This quiz isn't ready yet."} onRetry={overview.refetch} />;
  const q = overview.data;

  // ───── result ─────
  if (current?.status === "SUBMITTED" && current.result) {
    const r = current.result;
    const review = new Map((r.review ?? []).map((x) => [x.questionId, x]));
    const left = q.attemptsLeft;
    return (
      <View style={{ gap: space.md }}>
        <Card style={{ borderColor: r.passed ? colors.success : colors.border }}>
          <Heading style={{ color: r.passed ? colors.success : colors.foreground }}>
            {r.passed ? "Passed" : "Not passed yet"} — {r.scorePercent}%
          </Heading>
          <Body muted small>
            {r.pointsAwarded} of {r.pointsPossible} points.{r.passed ? " This lesson is complete." : ` You need ${r.passPercent}% to pass.`}
            {r.autoSubmitted ? " Time ran out, so your saved answers were submitted." : ""}
            {r.courseCompleted ? " You've completed the course!" : ""}
          </Body>
        </Card>
        {r.review
          ? current.questions.map((question, i) => {
              const rv = review.get(question.id);
              const mine = current.answers.find((a) => a.questionId === question.id);
              return (
                <Card key={question.id}>
                  <Body>
                    {i + 1}. {question.prompt}
                  </Body>
                  <Badge text={rv?.correct ? "Correct" : "Incorrect"} tone={rv?.correct ? "success" : "danger"} />
                  {question.type === "NUMERIC" ? (
                    <Body small muted>
                      Your answer {mine?.numericValue ?? "—"} · correct {rv?.numericAnswer}
                      {rv?.numericTolerance ? ` ± ${rv.numericTolerance}` : ""}
                    </Body>
                  ) : (
                    question.options.map((o) => (
                      <Body key={o.id} small style={{ color: rv?.correctOptionIds.includes(o.id) ? colors.success : mine?.optionIds.includes(o.id) ? colors.danger : colors.muted }}>
                        {rv?.correctOptionIds.includes(o.id) ? "✓ " : mine?.optionIds.includes(o.id) ? "✗ " : "   "}
                        {o.label}
                      </Body>
                    ))
                  )}
                  {rv?.explanation ? <Body small muted>{rv.explanation}</Body> : null}
                </Card>
              );
            })
          : null}
        {left === null || left > 0 ? <Button title="Try again" variant="outline" onPress={start} busy={busy} /> : null}
      </View>
    );
  }

  // ───── before starting ─────
  if (!current) {
    return (
      <Card>
        <Heading>{q.title}</Heading>
        <Body muted small>
          {q.questionCount} questions · pass mark {q.passPercent}%{q.timeLimitSeconds ? ` · ${Math.round(q.timeLimitSeconds / 60)} min` : ""} ·{" "}
          {q.maxAttempts === null ? "unlimited attempts" : `${q.attemptsLeft} of ${q.maxAttempts} attempts left`}
        </Body>
        {q.bestScorePercent !== null ? (
          <Body small style={{ color: q.passed ? colors.success : colors.muted }}>
            Best score {q.bestScorePercent}%{q.passed ? " — passed" : ""}
          </Body>
        ) : null}
        {error ? <Body small style={{ color: colors.danger }}>{error}</Body> : null}
        {!tracked ? (
          <Body small muted>Staff preview — attempts aren&apos;t recorded.</Body>
        ) : q.attemptsLeft === 0 ? (
          <Body small muted>You&apos;ve used all your attempts.</Body>
        ) : (
          <Button title={q.attemptsUsed ? "Start another attempt" : "Start quiz"} onPress={start} busy={busy} />
        )}
      </Card>
    );
  }

  // ───── taking it ─────
  const count = current.questions.filter((x) => answered(given(x.id))).length;
  return (
    <View style={{ gap: space.md }}>
      <View style={s.status}>
        <Body small muted>
          {count}/{current.questions.length} answered{saving === "saving" ? " · saving…" : saving === "saved" ? " · saved" : saving === "error" ? " · not saved" : ""}
        </Body>
        {deadline !== null ? (
          <Text style={[s.timer, deadline - now < 60_000 && { color: colors.danger }]} accessibilityLabel={`Time left ${clock(deadline - now)}`}>
            ⏱ {clock(deadline - now)}
          </Text>
        ) : null}
      </View>
      {current.questions.map((question, i) => {
        const g = given(question.id);
        const multi = question.type === "MULTI_CHOICE";
        return (
          <Card key={question.id}>
            <Body small muted>
              Question {i + 1} · {question.points} pt{question.points === 1 ? "" : "s"}
              {multi ? " · choose all that apply" : ""}
            </Body>
            <Body>{question.prompt}</Body>
            {question.type === "NUMERIC" ? (
              <TextInput
                value={g?.numericText ?? ""}
                onChangeText={(text) => {
                  const raw = text.replace(",", ".");
                  update(question.id, { optionIds: [], numericValue: raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : null, numericText: text });
                }}
                keyboardType="decimal-pad"
                placeholder="Your answer"
                placeholderTextColor={colors.muted}
                accessibilityLabel={`Answer to question ${i + 1}`}
                style={s.input}
              />
            ) : (
              question.options.map((o) => {
                const selected = g?.optionIds.includes(o.id) ?? false;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      const now = g?.optionIds ?? [];
                      update(question.id, { optionIds: multi ? (selected ? now.filter((id) => id !== o.id) : [...now, o.id]) : [o.id], numericValue: null, numericText: "" });
                    }}
                    accessibilityRole={multi ? "checkbox" : "radio"}
                    accessibilityState={{ checked: selected }}
                    style={[s.option, selected && s.optionSelected]}
                  >
                    <Text style={s.mark}>{multi ? (selected ? "☑" : "☐") : selected ? "◉" : "○"}</Text>
                    <Text style={s.optionText}>{o.label}</Text>
                  </Pressable>
                );
              })
            )}
          </Card>
        );
      })}
      {error ? <Body small style={{ color: colors.danger }}>{error}</Body> : null}
      <Button title={`Submit answers${count < current.questions.length ? ` (${current.questions.length - count} unanswered)` : ""}`} onPress={submit} busy={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.xs },
  timer: { color: colors.foreground, fontFamily: "monospace", fontSize: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderInput, borderRadius: radius.sm, paddingHorizontal: space.md, color: colors.foreground, fontSize: 16, backgroundColor: colors.background },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  optionSelected: { borderColor: colors.cyan, backgroundColor: colors.surfaceRaised },
  mark: { color: colors.cyan, fontSize: 18, width: 22 },
  optionText: { color: colors.foreground, fontSize: 16, flex: 1 },
});
