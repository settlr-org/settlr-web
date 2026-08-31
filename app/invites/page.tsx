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
import { Friend, Group } from "../../lib/types";

type Invite = {
  id: string;
  group_id: string;
  group_name: string;
  email: string;
  created_at: string;
};

export default function Invitations() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<Invite[]>([]);
  const [groupId, setGroupId] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [g, f, i] = await Promise.all([
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
        apiFetch<{ data: Friend[] }>("/api/v1/friends"),
        apiFetch<{ data: Invite[] }>("/api/v1/invites"),
      ]);
      setGroups(g.data);
      setFriends(f.data);
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
    const friendId = String(
      new FormData(event.currentTarget).get("friend_id") || "",
    );
    const friend = friends.find((item) => item.user_id === friendId);
    setError("");
    try {
      await apiFetch(`/api/v1/groups/${groupId}/invites`, {
        method: "POST",
        body: JSON.stringify({ user_id: friendId }),
      });
      setSent(`Invitation sent to ${friend?.name || "your friend"}.`);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not send invitation.");
    }
  };
  return (
    <AppShell
      title="Invitations"
      eyebrow="BRING PEOPLE IN"
      description="Invite accepted friends and keep pending group invitations together."
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="two-column">
          <Panel>
            <PanelTitle
              title="Invite a friend"
              meta="Accepted friends receive a secure link that expires in seven days"
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
                {friends.length ? (
                  <>
                    <label>
                      Friend
                      <select name="friend_id" required>
                        {friends.map((friend) => (
                          <option key={friend.user_id} value={friend.user_id}>
                            {friend.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button primary">
                      <SendOutlined /> Send invitation
                    </button>
                  </>
                ) : (
                  <Empty
                    icon={<TeamOutlined />}
                    text="Add a friend before sending a group invitation."
                    action={
                      <Link className="button" href="/friends">
                        Go to friends
                      </Link>
                    }
                  />
                )}
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
