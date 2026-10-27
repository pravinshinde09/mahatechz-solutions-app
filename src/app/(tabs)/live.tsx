import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLive } from "@/api/queries";
import { Badge, Body, Card, EmptyState, ErrorState, Loading, Screen } from "@/components/ui";
import { formatLiveTime } from "@/lib/format";
import { colors, radius, space } from "@/theme/tokens";

const statusTone = { SCHEDULED: "muted", LIVE: "danger", COMPLETED: "muted", CANCELLED: "warning" } as const;
const statusText = { SCHEDULED: "Scheduled", LIVE: "Live now", COMPLETED: "Finished", CANCELLED: "Cancelled" } as const;

export default function LiveScreen() {
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const { data, isLoading, error, refetch, isRefetching } = useLive(when);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 3 }} accessibilityRole="tablist">
        {(["upcoming", "past"] as const).map((w) => (
          <Pressable key={w} onPress={() => setWhen(w)} accessibilityRole="tab" accessibilityState={{ selected: when === w }} style={{ flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm - 2, backgroundColor: when === w ? colors.surfaceRaised : "transparent" }}>
            <Text style={{ color: when === w ? colors.foreground : colors.muted, fontWeight: "600" }}>{w === "upcoming" ? "Upcoming" : "Past & recordings"}</Text>
          </Pressable>
        ))}
      </View>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title={when === "upcoming" ? "No live classes scheduled" : "No past classes yet"} description="Classes for your courses appear here. The join link opens 30 minutes before the start." />
      ) : (
        data.map((s) => (
          <Card key={s.id} onPress={() => router.push(`/live/${s.id}`)} accessibilityLabel={s.title}>
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Badge text={s.joinOpen ? "Join open" : statusText[s.status]} tone={s.joinOpen ? "danger" : statusTone[s.status]} />
              <Body muted small style={{ flex: 1 }} numberOfLines={1}>
                {s.course.title}
              </Body>
            </View>
            <Body style={{ fontWeight: "600" }}>{s.title}</Body>
            <Body muted small>
              {formatLiveTime(s.startsAt, s.endsAt)}
            </Body>
          </Card>
        ))
      )}
    </Screen>
  );
}
