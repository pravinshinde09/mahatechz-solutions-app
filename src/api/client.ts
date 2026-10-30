import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import Constants from "expo-constants";
import type { ErrorCode } from "@/contracts/errors";
import { supabase } from "@/auth/supabase";
import { readRefreshToken, writeRefreshToken } from "@/auth/token-store";

/** Android emulator reaches the host machine on 10.0.2.2. Set EXPO_PUBLIC_API_URL for devices. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000").replace(/\/$/, "");
/** Public website, for "enrol on our website" copy and support links (spec §23.10). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://mahatecz.example").replace(/\/$/, "");
const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    readonly details?: { path: string; issue: string }[],
  ) {
    super(message);
  }
}

// ───────────── tokens (spec §23.4): a Supabase session (ADR 0009 in the API repo) ─────────────

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<(signedIn: boolean) => void>();

export const onSessionChange = (fn: (signedIn: boolean) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export async function setSession(tokens: SessionTokens | null) {
  accessToken = tokens?.accessToken ?? null;
  await writeRefreshToken(tokens?.refreshToken ?? null);
  for (const fn of listeners) fn(!!tokens);
}

/** Single-flight: concurrent 401s wait for one refresh; a failed refresh signs out. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) return false;
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        // Network trouble keeps the stored token for the next try; a rejected token signs out.
        if (!isAuthRetryableFetchError(error)) await setSession(null);
        return false;
      }
      await setSession({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ───────────── requests ─────────────

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

const requestId = () => `app_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

async function raw<T>(path: string, { method = "GET", body, auth = false }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: {
        accept: "application/json",
        "x-request-id": requestId(),
        // Lets the API turn away unsupported app versions with 426 later (spec §23.3).
        "x-client-version": APP_VERSION,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(auth && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "You seem to be offline. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code: ErrorCode; message: string; details?: { path: string; issue: string }[] } } | null;
  if (res.ok) return (json && "data" in json ? json.data : json) as T;
  throw new ApiError(res.status, json?.error?.code ?? "INTERNAL_ERROR", json?.error?.message ?? "Something went wrong. Please try again.", json?.error?.details);
}

/** Authenticated call: refreshes once on 401, then retries. */
export async function api<T>(path: string, options: Omit<Options, "auth"> = {}): Promise<T> {
  if (!accessToken) await refreshSession();
  try {
    return await raw<T>(path, { ...options, auth: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && (await refreshSession())) return raw<T>(path, { ...options, auth: true });
    throw err;
  }
}

/** Endpoints that return `{ data, page, … }` at the top level. */
export async function apiEnvelope<T>(path: string): Promise<T> {
  if (!accessToken) await refreshSession();
  const call = async () => {
    const res = await fetch(`${API_URL}/api/v1${path}`, { headers: { accept: "application/json", "x-client-version": APP_VERSION, ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) } });
    if (res.status === 401) return null;
    if (!res.ok) throw new ApiError(res.status, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    return (await res.json()) as T;
  };
  try {
    const first = await call();
    if (first) return first;
    if (await refreshSession()) {
      const second = await call();
      if (second) return second;
    }
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in again.");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, "NETWORK_ERROR", "You seem to be offline. Check your connection and try again.");
  }
}

export const publicApi = <T>(path: string, options: Omit<Options, "auth"> = {}) => raw<T>(path, options);
