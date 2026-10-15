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
  ApiError,
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
  /** Set when the session could not be verified for a reason other than 401. */
  sessionError: string | null;
  retrySession: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
};
const SessionContext = createContext<SessionValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setSessionError(null);
    if (!hasSession()) {
      setUser(null);
      return;
    }
    try {
      setUser(await apiFetch<User>("/api/v1/me"));
    } catch (x) {
      // Only a 401 means the session is gone. A 5xx, timeout or dropped
      // connection says nothing about the session, so keep it and let the
      // user retry instead of signing them out.
      if (x instanceof ApiError && x.status === 401) {
        clearSession();
        setUser(null);
      } else {
        setSessionError(
          x instanceof Error ? x.message : "We couldn't reach Settlr.",
        );
      }
    }
  }, []);
  const retrySession = useCallback(async () => {
    setLoading(true);
    await refresh();
    setLoading(false);
  }, [refresh]);
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
    try {
      await logout();
    } finally {
      // Local sign-out must work even when the server cannot be reached.
      setUser(null);
      setSessionError(null);
    }
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
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        signOut,
        refresh,
        sessionError,
        retrySession,
      }}
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
