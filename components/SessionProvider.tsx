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
  clearSession,
  hasSession,
  logout,
} from "../lib/api";
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
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
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
    const session = await authenticate(mode, values);
    setUser(
      (session.user as User | undefined) ??
        (await apiFetch<User>("/api/v1/me")),
    );
  };
  const signOut = async () => {
    await logout();
    setUser(null);
  };
  return (
    <SessionContext.Provider
      value={{ user, loading, signIn, signOut, refresh }}
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
