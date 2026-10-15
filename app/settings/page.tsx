"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  BellOutlined,
  BankOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DownloadOutlined,
  LockOutlined,
  LogoutOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  WalletOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { Panel, PanelTitle, useConfirmation } from "../../components/UI";
import { PasswordInput } from "../../components/PasswordInput";
import { useSession } from "../../components/SessionProvider";
import { WalletSettingsPanels } from "../../components/wallet/WalletSettingsPanels";
import { apiDownload, apiFetch } from "../../lib/api";
import {
  deviceLabel,
  displayIp,
  initials,
  isMobileAgent,
} from "../../lib/types";
type Prefs = {
  email_enabled: boolean;
  push_enabled: boolean;
  friend_request_enabled: boolean;
  expense_enabled: boolean;
  settlement_enabled: boolean;
};
type Session = {
  id: string;
  user_agent: string;
  ip: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at?: string;
};
type Payment = {
  bank_qr_url: string;
  bank_name: string;
  payment_handle: string;
};
export default function Settings() {
  const requestConfirmation = useConfirmation();
  const { user, refresh, signOut } = useSession();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>();
  const [sessions, setSessions] = useState<Session[]>([]);
  // Refresh-token rotation leaves a revoked row per refresh; only live ones are useful here.
  const activeSessions = sessions.filter(
    (s) => !s.revoked_at && new Date(s.expires_at) > new Date(),
  );
  const [payment, setPayment] = useState<Payment>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const showSaved = useCallback((message: string) => {
    setError("");
    setSaved(message);
  }, []);
  const showError = useCallback((message: string) => {
    setSaved("");
    setError(message);
  }, []);
  const load = useCallback(async () => {
    try {
      const [p, s, pay] = await Promise.all([
        apiFetch<Prefs>("/api/v1/me/notification-preferences"),
        apiFetch<{ data: Session[] }>("/api/v1/auth/sessions"),
        apiFetch<Payment>("/api/v1/me/payment-info"),
      ]);
      setPrefs(p);
      setSessions(s.data);
      setPayment(pay);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to load settings.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const profile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: d.get("name"),
          email: d.get("email"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      await refresh();
      setSaved("Profile saved.");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save profile.");
    }
  };
  const password = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    try {
      await apiFetch("/api/v1/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: user?.has_password ? d.get("current_password") : "",
          new_password: d.get("new_password"),
        }),
      });
      form.reset();
      await refresh();
      setSaved(
        user?.has_password
          ? "Password updated."
          : "Password set. You can now sign in with email and password too.",
      );
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not update password.");
    }
  };
  const toggle = async (key: keyof Prefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await apiFetch("/api/v1/me/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify(next),
      });
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "Could not update notification preference.",
      );
    }
  };
  const leave = async () => {
    await signOut();
    router.replace("/login");
  };
  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const updated = await apiFetch<Payment>("/api/v1/me/payment-info", {
        method: "PUT",
        body: JSON.stringify({
          bank_name: data.get("bank_name"),
          payment_handle: data.get("payment_handle"),
          bank_qr_url: data.get("bank_qr_url"),
        }),
      });
      setPayment(updated);
      setSaved("Payment details saved.");
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Could not save payment details.",
      );
    }
  };
  const revoke = async (id?: string) => {
    if (
      !(await requestConfirmation({
        title: id ? "Revoke this session?" : "Sign out every device?",
        description: id
          ? "This device will need to sign in again."
          : "Every active session, including this one, will be signed out.",
        confirmLabel: id ? "Revoke session" : "Sign out everywhere",
        danger: true,
      }))
    )
      return;
    try {
      await apiFetch(
        id ? `/api/v1/auth/sessions/${id}` : "/api/v1/auth/sessions",
        { method: "DELETE" },
      );
      if (!id) {
        await leave();
        return;
      }
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not revoke session.");
    }
  };
  const deleteAccount = async () => {
    if (
      !(await requestConfirmation({
        title: "Delete your account?",
        description:
          "Your identity will be anonymized and this cannot be undone.",
        confirmLabel: "Delete account",
        danger: true,
        requireText: "DELETE",
      }))
    )
      return;
    try {
      await apiFetch("/api/v1/me", { method: "DELETE" });
      await leave();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not delete account.");
    }
  };
  return (
    <AppShell
      title="Settings"
      eyebrow="YOUR ACCOUNT"
      description="Profile, notifications, security, wallet, and active sessions."
    >
      {(error || saved) && (
        <div className={error ? "alert" : "success-banner"}>
          {error || saved}
        </div>
      )}
      <div className="settings-layout">
        <nav className="settings-nav">
          <a href="#profile">
            <UserOutlined /> Profile
          </a>
          <a href="#notifications">
            <BellOutlined /> Notifications
          </a>
          <a href="#security">
            <LockOutlined /> Security
          </a>
          <a href="#payments">
            <BankOutlined /> Payments
          </a>
          <a href="#wallet">
            <WalletOutlined /> Wallet
          </a>
          <a href="#rates">
            <SwapOutlined /> Exchange rates
          </a>
          <a href="#sessions">
            <SafetyCertificateOutlined /> Sessions
          </a>
        </nav>
        <div>
          <Panel>
            <span id="profile" />
            <PanelTitle
              title="Profile"
              meta="The details people see in shared groups"
            />
            <div className="profile-hero">
              <span className="avatar account-avatar">
                {initials(user?.name)}
              </span>
              <div>
                <strong>{user?.name}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <form onSubmit={profile}>
              <div className="form-grid">
                <label>
                  Name
                  <input name="name" defaultValue={user?.name} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" defaultValue={user?.email} />
                </label>
              </div>
              <button className="button primary">Save profile</button>
            </form>
          </Panel>
          <Panel>
            <span id="notifications" />
            <PanelTitle
              title="Notifications"
              meta="Choose which updates reach you"
            />
            {prefs &&
              (
                [
                  [
                    "email_enabled",
                    "Email notifications",
                    "Get updates by email.",
                  ],
                  [
                    "push_enabled",
                    "Push notifications",
                    "Get alerts on your devices.",
                  ],
                  [
                    "friend_request_enabled",
                    "Friend requests",
                    "When someone asks to connect with you.",
                  ],
                  [
                    "expense_enabled",
                    "New expenses",
                    "When an expense is added to one of your groups.",
                  ],
                  [
                    "settlement_enabled",
                    "Settlements",
                    "When a payment is recorded with you.",
                  ],
                ] as [keyof Prefs, string, string][]
              ).map(([key, label, hint]) => (
                <div className="setting-row" key={key}>
                  <div>
                    <strong>{label}</strong>
                    <p>{hint}</p>
                  </div>
                  <button
                    className={prefs[key] ? "toggle active" : "toggle"}
                    type="button"
                    role="switch"
                    onClick={() => void toggle(key)}
                    aria-checked={prefs[key]}
                    aria-label={label}
                  >
                    <i />
                  </button>
                </div>
              ))}
          </Panel>
          <Panel>
            <span id="security" />
            <PanelTitle
              title={user?.has_password ? "Change password" : "Set a password"}
              meta={
                user?.has_password
                  ? "Use at least eight characters"
                  : "Add email-and-password sign-in to your Google account"
              }
            />
            <form onSubmit={password}>
              <div className="form-grid">
                {user?.has_password && (
                  <label>
                    Current password
                    <PasswordInput name="current_password" required />
                  </label>
                )}
                <label>
                  New password
                  <PasswordInput name="new_password" minLength={8} required />
                </label>
              </div>
              <button className="button">
                {user?.has_password ? "Update password" : "Set password"}
              </button>
            </form>
          </Panel>
          <Panel>
            <span id="payments" />
            <PanelTitle
              title="Payment details"
              meta="Friends can view these when settling with you"
            />
            {payment && (
              <form className="stack-form" onSubmit={savePayment}>
                <div className="form-grid">
                  <label>
                    Bank name
                    <input
                      name="bank_name"
                      defaultValue={payment.bank_name}
                      placeholder="Your bank"
                    />
                  </label>
                  <label>
                    Payment handle
                    <input
                      name="payment_handle"
                      defaultValue={payment.payment_handle}
                      placeholder="Wallet, UPI, Venmo…"
                    />
                  </label>
                </div>
                <label>
                  Payment QR URL
                  <input
                    name="bank_qr_url"
                    type="url"
                    defaultValue={payment.bank_qr_url}
                    placeholder="https://…"
                  />
                </label>
                <button className="button">
                  <BankOutlined /> Save payment details
                </button>
              </form>
            )}
          </Panel>
          <WalletSettingsPanels onSaved={showSaved} onError={showError} />
          <Panel>
            <span id="sessions" />
            <PanelTitle
              title="Active sessions"
              meta={`${activeSessions.length} active`}
            />
            {activeSessions.map((s, index) => {
              const device = deviceLabel(s.user_agent);
              return (
                <article className="session-row" key={s.id}>
                  <span className="session-icon" aria-hidden="true">
                    {isMobileAgent(s.user_agent) ? (
                      <MobileOutlined />
                    ) : (
                      <DesktopOutlined />
                    )}
                  </span>
                  <div>
                    <strong title={s.user_agent || undefined}>{device}</strong>
                    <p>
                      {[
                        displayIp(s.ip),
                        `Last used ${new Date(s.last_used_at).toLocaleDateString()}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="session-revoke"
                    aria-label={`Revoke session ${index + 1} of ${activeSessions.length}: ${device}, last used ${new Date(s.last_used_at).toLocaleString()}`}
                    title="Revoke session"
                    onClick={() => void revoke(s.id)}
                  >
                    <LogoutOutlined />
                  </button>
                </article>
              );
            })}
            <div className="button-row session-actions">
              <button className="button danger" onClick={leave}>
                <LogoutOutlined /> Sign out of this device
              </button>
              <button className="button danger" onClick={() => void revoke()}>
                <LogoutOutlined /> Sign out all devices
              </button>
            </div>
          </Panel>
          <Panel>
            <PanelTitle
              title="Account data"
              meta="Verification, exports, and account ownership"
            />
            <div className="button-row">
              {user?.email_verified ? (
                <span className="status-pill">
                  <CheckCircleOutlined /> Email verified
                </span>
              ) : (
                <button
                  className="button"
                  onClick={() =>
                    void apiFetch("/api/v1/auth/resend-verification", {
                      method: "POST",
                      body: JSON.stringify({ email: user?.email }),
                    })
                      .then(() => setSaved("Verification email sent."))
                      .catch((x) =>
                        setError(
                          x instanceof Error
                            ? x.message
                            : "Could not resend the email.",
                        ),
                      )
                  }
                >
                  <BellOutlined /> Resend verification
                </button>
              )}
              <button
                className="button"
                onClick={() =>
                  void apiDownload(
                    "/api/v1/me/export.csv",
                    "settlr-account.csv",
                  )
                }
              >
                <DownloadOutlined /> Export CSV
              </button>
              <button
                className="button"
                onClick={() =>
                  void apiDownload(
                    "/api/v1/me/export.json",
                    "settlr-account.json",
                  )
                }
              >
                <DownloadOutlined /> Export JSON
              </button>
            </div>
            <div className="danger-inline">
              <div>
                <strong>Delete account</strong>
                <p>
                  Your name and email are anonymized while financial records
                  remain consistent.
                </p>
              </div>
              <button
                className="button danger"
                onClick={() => void deleteAccount()}
              >
                <DeleteOutlined /> Delete account
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
