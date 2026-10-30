import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

// Sign-in is Supabase Auth (ADR 0009 in the API repo). EXPO_PUBLIC_* values are inlined into the
// bundle: the publishable key is meant to be public; never put the secret key here.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(url && key);

/**
 * The SDK keeps the session in memory only: the refresh token is stored in the OS keystore by
 * token-store.ts (spec §23.4) and refreshing is driven by api/client.ts, so nothing lands in
 * AsyncStorage and there is a single place that renews sessions.
 */
export const supabase = createClient(url || "https://not-configured.invalid", key || "not-configured", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce" },
});
