import { Image } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useCatalog } from "@/api/queries";
import { Body, Card, EmptyState, ErrorState, Loading, Screen, TextField } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { radius } from "@/theme/tokens";

/** Catalogue browse and search. No prices or purchase buttons in the app (spec §23.10). */
export default function DiscoverScreen() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch, isRefetching } = useCatalog(search);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <TextField label="Search courses" value={q} onChangeText={setQ} placeholder="AutoCAD Electrical, Revit, lighting…" returnKeyType="search" onSubmitEditing={() => setSearch(q.trim())} />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No courses found" description="Try a different search." />
      ) : (
        data.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/course/${c.slug}`)} accessibilityLabel={c.title}>
            {c.thumbnailUrl ? <Image source={{ uri: c.thumbnailUrl }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.sm }} accessibilityIgnoresInvertColors /> : null}
            <Body style={{ fontWeight: "600" }}>{c.title}</Body>
            {c.subtitle ? (
              <Body muted small numberOfLines={2}>
                {c.subtitle}
              </Body>
            ) : null}
            <Body muted small>
              {[c.category.name, `${c.lessonCount} lessons`, formatDuration(c.durationMinutes * 60)].filter(Boolean).join(" · ")}
            </Body>
          </Card>
        ))
      )}
    </Screen>
  );
}
