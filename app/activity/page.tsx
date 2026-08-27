"use client";
import { useCallback, useEffect, useState } from "react";
import { DollarOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Event, labelize } from "../../lib/types";
export default function Activity() {
  const [data, setData] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(
        (await apiFetch<{ data: Event[] }>("/api/v1/activity?limit=100")).data,
      );
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <AppShell
      title="Activity"
      eyebrow="YOUR HISTORY"
      description="A chronological record of every shared-money change."
    >
      {loading ? (
        <Loading />
      ) : (
        <Panel>
          <PanelTitle
            title="All activity"
            meta={`${data.length} recent events`}
          />
          {error && <ErrorState message={error} retry={load} />}
          <div className="timeline">
            {data.map((e) => (
              <article key={e.id}>
                <span>
                  <DollarOutlined />
                </span>
                <div>
                  <h3>
                    {typeof e.payload?.description === "string"
                      ? e.payload.description
                      : labelize(e.type)}
                  </h3>
                  <p>{labelize(e.type)}</p>
                </div>
                <time>
                  {new Date(e.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            ))}
          </div>
          {!data.length && (
            <Empty
              icon={<UnorderedListOutlined />}
              text="Your expenses, settlements, comments, and group changes will appear here."
            />
          )}
        </Panel>
      )}
    </AppShell>
  );
}
