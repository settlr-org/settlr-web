"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BellOutlined,
  CheckOutlined,
  DollarOutlined,
  SwapOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  LoadError,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Notification } from "../../lib/types";
import { type LoadFailure, toLoadFailure } from "../../lib/errors";
import { formatDateTime } from "../../lib/dates";
export default function Notifications() {
  const [data, setData] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const load = useCallback(async () => {
    try {
      setLoadFailure(null);
      const r = await apiFetch<{ data: Notification[]; unread_count: number }>(
        "/api/v1/notifications?limit=100",
      );
      setData(r.data);
      setUnread(r.unread_count);
    } catch (x) {
      setLoadFailure(toLoadFailure(x, "Unable to load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const read = async (id?: string) => {
    await apiFetch(
      id
        ? `/api/v1/notifications/${id}/read`
        : "/api/v1/notifications/read-all",
      { method: "POST" },
    );
    await load();
  };
  const icon = (type: string) =>
    type.includes("FRIEND") ? (
      <TeamOutlined />
    ) : type.includes("SETTLEMENT") ? (
      <SwapOutlined />
    ) : (
      <DollarOutlined />
    );
  return (
    <AppShell
      title="Notifications"
      eyebrow="INBOX"
      description="Invites, expenses, settlements, and requests that need your attention."
      actions={
        unread ? (
          <button className="button" onClick={() => void read()}>
            <CheckOutlined /> Mark all read
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <Loading />
      ) : loadFailure ? (
        <LoadError
          failure={loadFailure}
          retry={load}
          backHref="/overview"
          backLabel="Back to Home"
        />
      ) : (
        <Panel>
          <PanelTitle title="Inbox" meta={`${unread} unread`} />
          {error && <ErrorState message={error} retry={load} />}
          <div className="notification-list">
            {data.map((n) => (
              <button
                key={n.id}
                className={
                  n.read_at ? "notification-row" : "notification-row unread"
                }
                onClick={() => !n.read_at && void read(n.id)}
              >
                <span>{icon(n.type)}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>{formatDateTime(n.created_at)}</small>
                </div>
                {!n.read_at && <i />}
              </button>
            ))}
          </div>
          {!data.length && (
            <Empty
              icon={<BellOutlined />}
              title="Your inbox is clear"
              text="New expense, friend, invite, and settlement updates will appear here."
            />
          )}
        </Panel>
      )}
    </AppShell>
  );
}
