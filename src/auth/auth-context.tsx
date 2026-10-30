import type { AuthError, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@/contracts/me";
import { api, ApiError, onSessionChange, refreshSession, setSession } from "@/api/client";
import { supabase, supabaseConfigured } from "./supabase";

type Status = "loading" | "signedIn" | "signedOut";

interface AuthValue {
  status: Status;
  user: MeResponse | null;
  /** Emails a one-time code; an unknown address becomes a new student account. */
  sendCode(email: string, fullName?: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  reloadUser(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}

/** Supabase errors as the ApiError the screens already display. */
function fromSupabase(error: AuthError, fallback: string): ApiError {
  if (error.status === 429) return new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes.");
  if (error.name === "AuthRetryableFetchError") return new ApiError(0, "NETWORK_ERROR", "You seem to be offline. Check your connection and try again.");
  return new ApiError(error.status ?? 400, "VALIDATION_FAILED", fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const queryClient = useQueryClient();

  const reloadUser = useCallback(async () => {
    try {
      setUser(await api<MeResponse>("/me"));
      setStatus("signedIn");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setStatus("signedOut");
      else if (!(err instanceof ApiError && err.code === "NETWORK_ERROR")) throw err;
    }
  }, []);

  // On launch: a stored refresh token silently restores the session.
  useEffect(() => {
    void (async () => {
      if (await refreshSession()) await reloadUser().catch(() => setStatus("signedOut"));
      else setStatus("signedOut");
    })();
    return onSessionChange((signedIn) => {
      if (signedIn) return;
      setUser(null);
      setStatus("signedOut");
      queryClient.clear();
    });
  }, [reloadUser, queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    await setSession(null);
  }, []);

  /** The first API call also creates (or links) the account. Staff use the website, where 2FA runs. */
  const finishSignIn = useCallback(
    async (session: Session) => {
      await setSession({ accessToken: session.access_token, refreshToken: session.refresh_token });
      const me = await api<MeResponse>("/me");
      if (me.isStaff) {
        await signOut();
        throw new ApiError(403, "FORBIDDEN", "Staff accounts sign in on the website.");
      }
      setUser(me);
      setStatus("signedIn");
    },
    [signOut],
  );

  const sendCode = useCallback(async (email: string, fullName?: string) => {
    if (!supabaseConfigured) throw new ApiError(0, "INTERNAL_ERROR", "Sign-in isn't configured in this build.");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, ...(fullName ? { data: { full_name: fullName.trim() } } : {}) },
    });
    if (error) throw fromSupabase(error, "We couldn't send a code to that address. Check it and try again.");
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ""), type: "email" });
      if (error || !data.session) throw error ? fromSupabase(error, "That code is wrong or has expired.") : new ApiError(400, "VALIDATION_FAILED", "That code is wrong or has expired.");
      await finishSignIn(data.session);
    },
    [finishSignIn],
  );

  /** Google via Supabase in an in-app browser; Supabase redirects back to mahatecz://auth-callback. */
  const signInWithGoogle = useCallback(async () => {
    if (!supabaseConfigured) throw new ApiError(0, "INTERNAL_ERROR", "Sign-in isn't configured in this build.");
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } });
    if (error || !data.url) throw error ? fromSupabase(error, "Google sign-in isn't available right now.") : new ApiError(503, "PROVIDER_UNAVAILABLE", "Google sign-in isn't available right now.");
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return; // closed by the user
    const code = new URL(result.url).searchParams.get("code");
    if (!code) throw new ApiError(400, "VALIDATION_FAILED", "Google sign-in didn't complete. Please try again.");
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error || !exchanged.data.session) throw new ApiError(400, "VALIDATION_FAILED", "Google sign-in didn't complete. Please try again.");
    await finishSignIn(exchanged.data.session);
  }, [finishSignIn]);

  const value = useMemo(
    () => ({ status, user, sendCode, verifyCode, signInWithGoogle, signOut, reloadUser }),
    [status, user, sendCode, verifyCode, signInWithGoogle, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
