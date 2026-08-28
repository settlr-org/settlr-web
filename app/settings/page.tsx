"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  BellOutlined,
  LockOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ErrorState, Panel, PanelTitle } from "../../components/UI";
import { useSession } from "../../components/SessionProvider";
import { apiFetch } from "../../lib/api";
import { initials } from "../../lib/types";
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
export default function Settings() {
  const { user, refresh, signOut } = useSession();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        apiFetch<Prefs>("/api/v1/me/notification-preferences"),
        apiFetch<{ data: Session[] }>("/api/v1/auth/sessions"),
      ]);
      setPrefs(p);
      setSessions(s.data);
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
          default_currency: d.get("currency"),
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
          current_password: d.get("current_password"),
          new_password: d.get("new_password"),
        }),
      });
      form.reset();
      setSaved("Password updated.");
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
  return (
    <AppShell
      title="Settings"
      eyebrow="YOUR ACCOUNT"
      description="Profile, notifications, security, and active sessions."
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
                <label>
                  Default currency
                  <select
                    name="currency"
                    defaultValue={user?.default_currency || "NPR"}
                  >
                    <option>NPR</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>GBP</option>
                    <option>INR</option>
                  </select>
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
                  ["email_enabled", "Email notifications"],
                  ["push_enabled", "Push notifications"],
                  ["friend_request_enabled", "Friend requests"],
                  ["expense_enabled", "New expenses"],
                  ["settlement_enabled", "Settlements"],
                ] as [keyof Prefs, string][]
              ).map(([key, label]) => (
                <div className="setting-row" key={key}>
                  <div>
                    <strong>{label}</strong>
                    <p>Receive updates about {label.toLowerCase()}.</p>
                  </div>
                  <button
                    className={prefs[key] ? "toggle active" : "toggle"}
                    onClick={() => void toggle(key)}
                    aria-pressed={prefs[key]}
                    aria-label={`${prefs[key] ? "Disable" : "Enable"} ${label.toLowerCase()}`}
                  >
                    <i />
                  </button>
                </div>
              ))}
          </Panel>
          <Panel>
            <span id="security" />
            <PanelTitle
              title="Change password"
              meta="Use at least eight characters"
            />
            <form onSubmit={password}>
              <div className="form-grid">
                <label>
                  Current password
                  <input name="current_password" type="password" required />
                </label>
                <label>
                  New password
                  <input
                    name="new_password"
                    type="password"
                    minLength={8}
                    required
                  />
                </label>
              </div>
              <button className="button">Update password</button>
            </form>
          </Panel>
          <Panel>
            <span id="sessions" />
            <PanelTitle
              title="Active sessions"
              meta={`${sessions.filter((s) => !s.revoked_at).length} active`}
            />
            {sessions.map((s) => (
              <article className="session-row" key={s.id}>
                <WalletOutlined />
                <div>
                  <strong>{s.user_agent || "Unknown device"}</strong>
                  <p>
                    {s.ip} · Last used{" "}
                    {new Date(s.last_used_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={s.revoked_at ? "status-pill muted" : "status-pill"}
                >
                  {s.revoked_at ? "Revoked" : "Active"}
                </span>
              </article>
            ))}
            <button className="button danger settings-logout" onClick={leave}>
              <LogoutOutlined /> Sign out of this device
            </button>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
