import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoginResponse } from "@/contracts/auth";
import type { MeResponse } from "@/contracts/me";
import { api, ApiError, onSessionChange, publicApi, refreshSession, setSession } from "@/api/client";

type Status = "loading" | "signedIn" | "signedOut";

interface AuthValue {
  status: Status;
  user: MeResponse | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reloadUser(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await publicApi<LoginResponse>("/auth/login", { method: "POST", body: { email: email.trim().toLowerCase(), password, client: "mobile" } });
      if (res.twoFactorRequired) {
        // Staff sign in on the website (2FA); the app is for learning.
        throw new ApiError(403, "FORBIDDEN", "Staff accounts sign in on the website.");
      }
      await setSession(res.tokens);
      await reloadUser();
    },
    [reloadUser],
  );

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await setSession(null);
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut, reloadUser }), [status, user, signIn, signOut, reloadUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
