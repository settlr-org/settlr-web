"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Friend, FriendRequest, initials } from "../../lib/types";
type SearchUser = {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
};
export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        apiFetch<{ data: Friend[] }>("/api/v1/friends"),
        apiFetch<{ data: FriendRequest[] }>("/api/v1/friends/requests"),
      ]);
      setFriends(f.data);
      setRequests(r.data);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to load friends.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const search = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q");
    try {
      setResults(
        (
          await apiFetch<{ data: SearchUser[] }>(
            `/api/v1/users/search?q=${encodeURIComponent(String(q))}`,
          )
        ).data,
      );
    } catch (x) {
      setError(x instanceof Error ? x.message : "Search failed.");
    }
  };
  const act = async (path: string) => {
    try {
      await apiFetch(path, { method: "POST" });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Action failed.");
    }
  };
  return (
    <AppShell
      title="Friends"
      eyebrow="YOUR CIRCLE"
      description="Find people, manage requests, and keep direct shared ledgers."
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="two-column">
          <div>
            <Panel>
              <PanelTitle title="Find people" meta="Search by name or email" />
              <form className="friend-search" onSubmit={search}>
                <SearchOutlined />
                <input
                  name="q"
                  required
                  minLength={2}
                  placeholder="Name or email address"
                />
                <button className="button primary">Search</button>
              </form>
              {results.map((u) => (
                <article className="member-line" key={u.id}>
                  <span className="avatar soft">{initials(u.name)}</span>
                  <div>
                    <strong>{u.name}</strong>
                    <small>{u.email || "Settlr member"}</small>
                  </div>
                  <button
                    className="button"
                    onClick={() => void act(`/api/v1/friends/${u.id}/request`)}
                  >
                    <UserAddOutlined /> Add
                  </button>
                </article>
              ))}
            </Panel>
            <Panel>
              <PanelTitle
                title="Your friends"
                meta={`${friends.length} connected`}
              />
              {friends.map((f) => (
                <article className="friend-card" key={f.user_id}>
                  <span className="avatar">{initials(f.name)}</span>
                  <div>
                    <h3>{f.name}</h3>
                    <p>Direct expenses and settlements</p>
                  </div>
                  <span className="status-pill">Connected</span>
                </article>
              ))}
              {!friends.length && (
                <Empty
                  icon={<TeamOutlined />}
                  text="Search for someone you know and send a friend request."
                />
              )}
            </Panel>
          </div>
          <Panel>
            <PanelTitle title="Requests" meta={`${requests.length} waiting`} />
            {requests.map((r) => (
              <article className="request-card" key={r.friendship_id}>
                <span className="avatar soft">{initials(r.name)}</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>Wants to connect</small>
                </div>
                <button
                  className="accept"
                  onClick={() =>
                    void act(`/api/v1/friends/${r.from_user}/accept`)
                  }
                  aria-label={`Accept ${r.name}`}
                >
                  <CheckOutlined />
                </button>
                <button
                  className="reject"
                  onClick={() =>
                    void act(`/api/v1/friends/${r.from_user}/reject`)
                  }
                  aria-label={`Reject ${r.name}`}
                >
                  <CloseOutlined />
                </button>
              </article>
            ))}
            {!requests.length && (
              <Empty
                title="No pending requests"
                text="New requests will appear here."
              />
            )}
          </Panel>
          {error && <ErrorState message={error} retry={load} />}
        </div>
      )}
    </AppShell>
  );
}
