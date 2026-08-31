"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeftOutlined, MailOutlined } from "@ant-design/icons";
import { apiFetch } from "../../lib/api";
import { Brand } from "../../components/Brand";
export default function Forgot() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await apiFetch(
        "/api/v1/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email: data.get("email") }) },
        false,
      );
      setSent(true);
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Unable to send reset instructions.",
      );
    }
  };
  return (
    <main className="simple-auth">
      <Link href="/">
        <Brand />
      </Link>
      <form className="auth-form" onSubmit={submit}>
        <Link href="/login" className="back-link">
          <ArrowLeftOutlined /> Back to sign in
        </Link>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>{sent ? "Check your inbox" : "Reset your password"}</h2>
        {sent ? (
          <p>
            If that address belongs to an account, we sent password reset
            instructions.
          </p>
        ) : (
          <>
            <p>Enter the email address you use for Settlr.</p>
            <label>
              <span>Email address</span>
              <div>
                <MailOutlined />
                <input name="email" type="email" required />
              </div>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary auth-submit">
              Send reset link
            </button>
          </>
        )}
      </form>
    </main>
  );
}
