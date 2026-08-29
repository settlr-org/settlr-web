"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircleOutlined, MailOutlined } from "@ant-design/icons";
import { Brand } from "../../components/Brand";
import { apiFetch } from "../../lib/api";
export default function VerifyEmail() {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address…");
  const hasVerified = useRef(false);
  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;
    const token = new URLSearchParams(location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    apiFetch(
      "/api/v1/auth/verify-email",
      { method: "POST", body: JSON.stringify({ token }) },
      false,
    )
      .then(() => {
        setState("done");
        setMessage("Your email address is verified.");
      })
      .catch((e) => {
        setState("error");
        setMessage(
          e instanceof Error
            ? e.message
            : "This verification link is invalid or expired.",
        );
      });
  }, []);
  return (
    <main className="simple-auth">
      <Link href="/">
        <Brand />
      </Link>
      <section className="auth-form verify-card">
        {state === "done" ? <CheckCircleOutlined /> : <MailOutlined />}
        <p className="eyebrow">EMAIL VERIFICATION</p>
        <h2>
          {state === "loading"
            ? "One moment"
            : state === "done"
              ? "You’re verified"
              : "We could not verify this link"}
        </h2>
        <p>{message}</p>
        <Link className="button primary auth-submit" href="/login">
          {state === "done" ? "Sign in" : "Back to sign in"}
        </Link>
      </section>
    </main>
  );
}
