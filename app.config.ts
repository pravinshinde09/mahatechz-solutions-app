import type { ExpoConfig } from "expo/config";

// Env-driven config (spec §23.1). EXPO_PUBLIC_* values are inlined into the JS bundle — never put
// secrets in them. The API URL is the only setting the app needs.
const config: ExpoConfig = {
  name: "Mahatecz Learning",
  slug: "mahatecz-learning",
  scheme: "mahatecz",
  version: "0.1.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0a1020",
  android: {
    package: "com.mahatecz.learning",
    adaptiveIcon: {
      backgroundColor: "#0a1020",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Consumption-only app (spec §23.10): no billing permission, nothing to buy in the app.
    blockedPermissions: ["com.android.vending.BILLING"],
  },
  ios: { supportsTablet: true, bundleIdentifier: "com.mahatecz.learning" },
  web: { favicon: "./assets/favicon.png", bundler: "metro" },
  plugins: ["expo-router", "expo-secure-store", "expo-video", "expo-sharing", "expo-web-browser"],
  experiments: { typedRoutes: true },
};

export default config;
