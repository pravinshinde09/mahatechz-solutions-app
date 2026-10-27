import NetInfo from "@react-native-community/netinfo";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { ProgressUpdate } from "@/contracts/learning";
import { api, ApiError } from "@/api/client";

/**
 * Progress heartbeats from the player (spec §15.5, §23.6). Beats that fail for network reasons are
 * kept with their original time (`sentAt`) in a small file and replayed when the device is back
 * online; the server still caps credit by its own clock. Only the latest beat per watch session is
 * kept — it carries the furthest position.
 */
export interface Beat {
  lessonId: string;
  watchSessionId: string;
  position: number;
  rate: number;
  playing: boolean;
  sentAt: string;
}

const MAX_QUEUED = 50;
let queue: Beat[] = [];
let loaded = false;
const file = Platform.OS === "web" ? null : new File(Paths.document, "pending-heartbeats.json");

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (file?.exists) queue = JSON.parse(await file.text()) as Beat[];
  } catch {
    queue = [];
  }
}

function persist() {
  try {
    if (!file) return;
    if (!file.exists) file.create();
    file.write(JSON.stringify(queue));
  } catch {
    // Best effort: losing a queued beat only under-counts watch time.
  }
}

const post = (b: Beat) =>
  api<ProgressUpdate>(`/lessons/${b.lessonId}/progress/heartbeat`, {
    method: "POST",
    body: { watchSessionId: b.watchSessionId, position: Math.max(0, b.position), rate: b.rate || 1, playing: b.playing, sentAt: b.sentAt },
  });

export async function sendBeat(beat: Omit<Beat, "sentAt">): Promise<ProgressUpdate | null> {
  await load();
  const b = { ...beat, sentAt: new Date().toISOString() };
  try {
    const res = await post(b);
    void flush();
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.code === "NETWORK_ERROR") {
      queue = [...queue.filter((q) => q.watchSessionId !== b.watchSessionId), b].slice(-MAX_QUEUED);
      persist();
    }
    // 429 / 4xx are dropped: the next beat carries the position again.
    return null;
  }
}

let flushing = false;
export async function flush() {
  await load();
  if (flushing || !queue.length) return;
  flushing = true;
  try {
    for (const b of [...queue]) {
      try {
        await post(b);
        queue = queue.filter((q) => q !== b);
      } catch (err) {
        if (err instanceof ApiError && err.code === "NETWORK_ERROR") break;
        queue = queue.filter((q) => q !== b); // rejected by the server: drop it
      }
    }
    persist();
  } finally {
    flushing = false;
  }
}

/** Call once at startup: replays queued beats whenever the connection comes back. */
export function startHeartbeatReplay() {
  void flush();
  return NetInfo.addEventListener((s) => {
    if (s.isConnected) void flush();
  });
}
