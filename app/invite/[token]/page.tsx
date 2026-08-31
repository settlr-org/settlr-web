"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckOutlined, MailOutlined } from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import { ErrorState, Panel, PanelTitle } from "../../../components/UI";
import { apiFetch, ApiError } from "../../../lib/api";
import { useSession } from "../../../components/SessionProvider";

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const destination = `/invite/${encodeURIComponent(token)}`;
  useEffect(() => {
    if (!loading && !user)
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
  }, [destination, loading, router, user]);
  const accept = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      try {
        const result = await apiFetch<{ group_id: string }>(
          `/api/v1/invites/${encodeURIComponent(token)}/accept`,
          { method: "POST" },
        );
        router.replace(`/groups/${result.group_id}`);
      } catch (groupError) {
        if (!(groupError instanceof ApiError) || groupError.status !== 404)
          throw groupError;
        const result = await apiFetch<{ user_id: string }>(
          `/api/v1/friend-invites/${encodeURIComponent(token)}/accept`,
          { method: "POST" },
        );
        router.replace(`/friends/${result.user_id}`);
      }
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not accept invitation.");
      setBusy(false);
    }
  };
  return (
    <AppShell
      title="Settlr invitation"
      eyebrow="YOU’RE INVITED"
      description="Sign in with the invited email to join the shared group."
    >
      <Panel className="focused-panel">
        <PanelTitle
          title="Ready to join?"
          meta="The invitation must match the email on your Settlr account."
        />
        {error && <ErrorState message={error} />}
        <div className="invite-accept">
          <MailOutlined />
          <p>
            Accepting adds you to the group and keeps you connected with the
            person who invited you.
          </p>
          <button className="button primary" onClick={accept} disabled={busy}>
            <CheckOutlined /> {busy ? "Joining…" : "Accept invitation"}
          </button>
        </div>
      </Panel>
    </AppShell>
  );
}
