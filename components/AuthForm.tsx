"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Brand } from "./Brand";
import { useSession } from "./SessionProvider";
import { apiFetch, ApiError, RegistrationResult } from "../lib/api";
import { GoogleSignInButton } from "./GoogleSignInButton";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { user, signIn, signInWithGoogle } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<RegistrationResult>();
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resent, setResent] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (user && !submitting.current) router.replace("/overview");
  }, [user, router]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await signIn(mode, {
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
        remember: mode === "register" || data.get("remember") === "on",
      });
      if (mode === "register" && result) {
        setRegistration(result);
        return;
      }
      const requested = new URLSearchParams(location.search).get("next");
      const destination =
        mode === "login" &&
        requested?.startsWith("/") &&
        !requested.startsWith("//")
          ? requested
          : "/overview";
      router.replace(destination);
    } catch (x) {
      submitting.current = false;
      if (mode === "login" && x instanceof ApiError && x.status === 403)
        setUnverifiedEmail(String(data.get("email") || ""));
      setError(
        x instanceof Error
          ? x.message
          : "We could not authenticate this account.",
      );
    } finally {
      setBusy(false);
    }
  };
  const googleSignIn = async (idToken: string) => {
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(idToken);
      const requested = new URLSearchParams(location.search).get("next");
      router.replace(
        requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/overview",
      );
    } catch (x) {
      submitting.current = false;
      setError(
        x instanceof Error
          ? x.message
          : "Google sign-in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const resend = async (email: string) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(
        "/api/v1/auth/resend-verification",
        { method: "POST", body: JSON.stringify({ email }) },
        false,
      );
      setResent(true);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not resend the email.");
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
        {registration ? (
          <div className="auth-form verification-pending">
            <span className="verification-seal">
              <MailOutlined />
            </span>
            <p className="eyebrow">CHECK YOUR INBOX</p>
            <h2>Verify your email</h2>
            <p>
              We sent a verification link to{" "}
              <strong>{registration.email}</strong>. Your account stays inactive
              until you confirm that address.
            </p>
            {resent && (
              <p className="success-note" role="status">
                <CheckCircleOutlined /> A fresh verification link was sent.
              </p>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="verification-actions">
              {registration.verification_token && (
                <Link
                  className="button primary"
                  href={`/verify-email?token=${registration.verification_token}`}
                >
                  Verify in this browser <ArrowRightOutlined />
                </Link>
              )}
              <button
                className="button"
                disabled={busy}
                onClick={() => void resend(registration.email)}
              >
                <MailOutlined /> {busy ? "Sending…" : "Resend email"}
              </button>
            </div>
            <p className="auth-switch">
              Already verified? <Link href="/login">Sign in</Link>
            </p>
          </div>
        ) : (
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
            <GoogleSignInButton
              disabled={busy}
              onToken={(token) => void googleSignIn(token)}
              onError={setError}
            />
            {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID && (
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            )}
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
                  <input name="remember" type="checkbox" /> Keep me signed in
                </label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {unverifiedEmail && (
              <button
                className="button verification-resend"
                type="button"
                disabled={busy}
                onClick={() => void resend(unverifiedEmail)}
              >
                <MailOutlined />
                {resent
                  ? "Verification email sent"
                  : "Resend verification email"}
              </button>
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
        )}
      </section>
    </main>
  );
}
