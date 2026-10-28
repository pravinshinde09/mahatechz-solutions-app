import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { Loading } from "@/components/ui";
import { startHeartbeatReplay } from "@/features/heartbeats";
import { colors } from "@/theme/tokens";

// Spec §23.3: retries with backoff (max 3) for reads only, never for client errors.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 3 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
    mutations: { retry: false },
  },
});

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));

function useAppFocus() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => sub.remove();
  }, []);
}

function RootStack() {
  const { status } = useAuth();
  useAppFocus();
  // Replays progress heartbeats queued while offline (spec §23.6).
  useEffect(() => (status === "signedIn" ? startHeartbeatReplay() : undefined), [status]);
  if (status === "loading") return <Loading />;
  const signedIn = status === "signedIn";
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[slug]" options={{ title: "Course" }} />
        <Stack.Screen name="learn/[courseId]/index" options={{ title: "Syllabus" }} />
        <Stack.Screen name="learn/[courseId]/[lessonId]" options={{ title: "Lesson" }} />
        <Stack.Screen name="live/[id]" options={{ title: "Live class" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="certificates" options={{ title: "Certificates" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: "Create account" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootStack />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
