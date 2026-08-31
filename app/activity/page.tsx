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
  Modal,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Event, Group, labelize, money } from "../../lib/types";
export default function Activity() {
  const [data, setData] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Event>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [events, groupData] = await Promise.all([
        apiFetch<{ data: Event[] }>("/api/v1/activity?limit=100"),
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
      ]);
      setData(events.data);
      setGroups(groupData.data);
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
              <button
                className="activity-row"
                key={e.id}
                onClick={() => setSelected(e)}
              >
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
              </button>
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
      {selected && (
        <Modal
          title={
            typeof selected.payload?.description === "string"
              ? selected.payload.description
              : labelize(selected.type)
          }
          subtitle="Activity details"
          onClose={() => setSelected(undefined)}
        >
          <div className="detail-list">
            <div>
              <span>When</span>
              <strong>{new Date(selected.created_at).toLocaleString()}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{labelize(selected.type)}</strong>
            </div>
            <div>
              <span>Group</span>
              <strong>
                {groups.find((group) => group.id === selected.group_id)?.name ||
                  (selected.group_id
                    ? "Group unavailable"
                    : "Personal activity")}
              </strong>
            </div>
            {typeof selected.payload?.amount === "number" && (
              <div>
                <span>Amount</span>
                <strong>
                  {money(
                    selected.payload.amount,
                    typeof selected.payload.currency === "string"
                      ? selected.payload.currency
                      : "NPR",
                  )}
                </strong>
              </div>
            )}
            {typeof selected.payload?.notes === "string" &&
              selected.payload.notes && (
                <div>
                  <span>Notes</span>
                  <strong>{selected.payload.notes}</strong>
                </div>
              )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
