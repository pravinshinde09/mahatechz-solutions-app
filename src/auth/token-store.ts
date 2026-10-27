import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Spec §23.4: refresh token in the OS keystore (expo-secure-store), access token in memory only.
// Never AsyncStorage. SecureStore has no web build; the web export (used for UI smoke tests)
// keeps the refresh token in memory, so a reload signs out there.
const KEY = "mz.refresh-token";
let webMemory: string | null = null;

export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") return webMemory;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeRefreshToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    webMemory = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
