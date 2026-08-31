"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  apiFetch,
  authenticate,
  authenticateWithGoogle,
  clearSession,
  hasSession,
  logout,
} from "../lib/api";
import type { RegistrationResult } from "../lib/api";
import type { User } from "../lib/types";

type SessionValue = {
  user: User | null;
  loading: boolean;
  signIn: (
    mode: "login" | "register",
    values: {
      name?: string;
      email: string;
      password: string;
      remember?: boolean;
    },
  ) => Promise<RegistrationResult | void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
};
const SessionContext = createContext<SessionValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!hasSession()) {
      setUser(null);
      return;
    }
    try {
      setUser(await apiFetch<User>("/api/v1/me"));
    } catch {
      clearSession();
      setUser(null);
    }
  }, []);
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);
  const signIn = async (
    mode: "login" | "register",
    values: {
      name?: string;
      email: string;
      password: string;
      remember?: boolean;
    },
  ) => {
    const result = await authenticate(mode, values);
    if (mode === "register") return result as RegistrationResult;
    const session = result as import("../lib/api").Session;
    setUser(
      (session.user as User | undefined) ??
        (await apiFetch<User>("/api/v1/me")),
    );
    return undefined;
  };
  const signOut = async () => {
    await logout();
    setUser(null);
  };
  const signInWithGoogle = async (idToken: string) => {
    const session = await authenticateWithGoogle(idToken);
    setUser(
      (session.user as User | undefined) ??
        (await apiFetch<User>("/api/v1/me")),
    );
  };
  return (
    <SessionContext.Provider
      value={{ user, loading, signIn, signInWithGoogle, signOut, refresh }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
