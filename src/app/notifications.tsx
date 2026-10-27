import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import { api } from "@/api/client";
import { keys, useNotifications } from "@/api/queries";
import { Body, Button, Card, EmptyState, ErrorState, Loading, Screen } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { colors, space } from "@/theme/tokens";

/** Web paths in notification links → app screens where one exists. */
function appRoute(link: string | null): string | null {
  if (!link) return null;
  const live = /^\/app\/live(?:\?session=|\/)([0-9a-f-]{36})/.exec(link);
  if (live) return `/live/${live[1]}`;
  if (link.startsWith("/app/live")) return "/live";
  return null;
}

export default function NotificationsScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useNotifications();
  const queryClient = useQueryClient();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load notifications."} onRetry={refetch} />;

  const markAll = async () => {
    await api("/me/notifications/read", { method: "POST", body: { all: true } });
    await queryClient.invalidateQueries({ queryKey: keys.notifications });
  };
  const open = async (id: string, link: string | null, unread: boolean) => {
    if (unread) void api("/me/notifications/read", { method: "POST", body: { ids: [id] } }).then(() => queryClient.invalidateQueries({ queryKey: keys.notifications }));
    const route = appRoute(link);
    if (route) router.push(route as never);
  };

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {data.unreadCount ? <Button title="Mark all as read" variant="outline" onPress={markAll} /> : null}
      {data.data.length ? (
        data.data.map((n) => (
          <Card key={n.id} onPress={() => void open(n.id, n.link, !n.readAt)} accessibilityLabel={`${n.readAt ? "" : "Unread: "}${n.title}`}>
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
              {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan, marginTop: 7 }} /> : null}
              <View style={{ flex: 1, gap: 2 }}>
                <Body style={{ fontWeight: n.readAt ? "400" : "600" }}>{n.title}</Body>
                {n.body ? <Body muted small>{n.body}</Body> : null}
                <Body muted small>
                  {formatDateTime(n.createdAt)}
                </Body>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="You're all caught up" description="Class reminders, announcements and replies from support appear here." />
      )}
    </Screen>
  );
}
