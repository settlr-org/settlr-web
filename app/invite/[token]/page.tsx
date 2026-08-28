"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckOutlined, MailOutlined } from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import { ErrorState, Panel, PanelTitle } from "../../../components/UI";
import { apiFetch } from "../../../lib/api";

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{ group_id: string }>(
        `/api/v1/invites/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );
      router.replace(`/groups/${result.group_id}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not accept invitation.");
      setBusy(false);
    }
  };
  return (
    <AppShell
      title="Group invitation"
      eyebrow="YOU’RE INVITED"
      description="Join the shared ledger linked to your email address."
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
            Accepting adds you to the group and makes its shared expenses
            visible.
          </p>
          <button className="button primary" onClick={accept} disabled={busy}>
            <CheckOutlined /> {busy ? "Joining…" : "Accept invitation"}
          </button>
        </div>
      </Panel>
    </AppShell>
  );
}
