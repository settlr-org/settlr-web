"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { LockOutlined } from "@ant-design/icons";
import { Brand } from "../../components/Brand";
import { apiFetch } from "../../lib/api";
export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => setToken(new URLSearchParams(location.search).get("token") || ""),
    [],
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch(
        "/api/v1/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: token || d.get("token"),
            new_password: d.get("password"),
          }),
        },
        false,
      );
      setDone(true);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not reset password.");
    }
  };
  return (
    <main className="simple-auth">
      <Link href="/">
        <Brand />
      </Link>
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>{done ? "Password changed" : "Choose a new password"}</h2>
        {done ? (
          <>
            <p>
              Your password has been updated and previous sessions were revoked.
            </p>
            <Link className="button primary auth-submit" href="/login">
              Return to sign in
            </Link>
          </>
        ) : (
          <>
            {!token && (
              <label>
                <span>Reset token</span>
                <div>
                  <LockOutlined />
                  <input name="token" required />
                </div>
              </label>
            )}
            <label>
              <span>New password</span>
              <div>
                <LockOutlined />
                <input name="password" type="password" minLength={8} required />
              </div>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary auth-submit">
              Update password
            </button>
          </>
        )}
      </form>
    </main>
  );
}
