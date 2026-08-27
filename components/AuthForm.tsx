"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Brand } from "./Brand";
import { useSession } from "./SessionProvider";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, signIn } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user) router.replace("/overview");
  }, [user, router]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(mode, {
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      router.replace("/overview");
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "We could not authenticate this account.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="back-link">
          <ArrowLeftOutlined /> Back home
        </Link>
        <div>
          <Brand />
          <p className="eyebrow">MAKE SHARED MONEY SIMPLE</p>
          <h1>
            {mode === "login"
              ? "Pick up where your group left off."
              : "A clean slate for every shared expense."}
          </h1>
          <p>
            Trips, homes, dinners and friendships stay easier when everyone sees
            the same ledger.
          </p>
        </div>
        <blockquote>
          “The best split is the one nobody has to think about twice.”
        </blockquote>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "JOIN SETTLR"}
          </p>
          <h2>
            {mode === "login" ? "Sign in to Settlr" : "Create your account"}
          </h2>
          <p>
            {mode === "login"
              ? "Your groups and balances are waiting."
              : "Start a shared ledger in less than a minute."}
          </p>
          {mode === "register" && (
            <label>
              <span>Your name</span>
              <div>
                <UserOutlined />
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Nabin Khanal"
                />
              </div>
            </label>
          )}
          <label>
            <span>Email address</span>
            <div>
              <MailOutlined />
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div>
              <LockOutlined />
              <input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="At least 8 characters"
              />
            </div>
          </label>
          {mode === "login" && (
            <div className="form-meta">
              <label className="check-label">
                <input type="checkbox" /> Keep me signed in
              </label>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary auth-submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}{" "}
            <ArrowRightOutlined />
          </button>
          <p className="auth-switch">
            {mode === "login" ? (
              <>
                New to Settlr? <Link href="/register">Create an account</Link>
              </>
            ) : (
              <>
                Already registered? <Link href="/login">Sign in</Link>
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
