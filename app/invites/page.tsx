"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MailOutlined, SendOutlined, TeamOutlined } from "@ant-design/icons";
import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Group } from "../../lib/types";

type Invite = {
  id: string;
  group_id: string;
  group_name: string;
  email: string;
  created_at: string;
};

export default function Invitations() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [received, setReceived] = useState<Invite[]>([]);
  const [groupId, setGroupId] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [g, i] = await Promise.all([
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
        apiFetch<{ data: Invite[] }>("/api/v1/invites"),
      ]);
      setGroups(g.data);
      setGroupId((current) => current || g.data[0]?.id || "");
      setReceived(i.data);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not load invitations.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") || "");
    setError("");
    try {
      await apiFetch(`/api/v1/groups/${groupId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(`Invitation sent to ${email}.`);
      form.reset();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not send invitation.");
    }
  };
  return (
    <AppShell
      title="Invitations"
      eyebrow="BRING PEOPLE IN"
      description="Invite anyone by email and keep pending group invitations together."
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="two-column">
          <Panel>
            <PanelTitle
              title="Invite by email"
              meta="They will receive a secure link that expires in seven days"
            />
            {error && <ErrorState message={error} retry={load} />}
            {sent && (
              <p className="success-note" role="status">
                {sent}
              </p>
            )}
            {groups.length ? (
              <form className="stack-form" onSubmit={invite}>
                <label>
                  Group
                  <select
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="friend@example.com"
                  />
                </label>
                <button className="button primary">
                  <SendOutlined /> Send invitation
                </button>
              </form>
            ) : (
              <Empty
                icon={<TeamOutlined />}
                text="Create a group before inviting people."
                action={
                  <Link className="button primary" href="/groups?create=1">
                    Create group
                  </Link>
                }
              />
            )}
          </Panel>
          <Panel>
            <PanelTitle
              title="Invitations for you"
              meta={`${received.length} awaiting your response`}
            />
            {received.map((invite) => (
              <article className="invite-line" key={invite.id}>
                <span>
                  <MailOutlined />
                </span>
                <div>
                  <strong>{invite.group_name}</strong>
                  <p>Sent to {invite.email}</p>
                </div>
                <small>Open the link from your email to accept</small>
              </article>
            ))}
            {!received.length && (
              <Empty
                icon={<MailOutlined />}
                text="Group invitations sent to your email will appear here."
              />
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
