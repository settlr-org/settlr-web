"use client";
import { useCallback, useEffect, useState } from "react";
import { DollarOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  LoadError,
  Panel,
  PanelTitle,
  Modal,
} from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { Event, Group, labelize, money } from "../../lib/types";
import { type LoadFailure, toLoadFailure } from "../../lib/errors";
import { plural } from "../../lib/format";
import { formatDate, formatDateTime } from "../../lib/dates";
export default function Activity() {
  const [data, setData] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Event>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const load = useCallback(async () => {
    try {
      setLoadFailure(null);
      const [events, groupData] = await Promise.all([
        apiFetch<{ data: Event[] }>("/api/v1/activity?limit=100"),
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
      ]);
      setData(events.data);
      setGroups(groupData.data);
    } catch (x) {
      setLoadFailure(toLoadFailure(x, "Unable to load activity."));
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
      ) : loadFailure ? (
        <LoadError
          failure={loadFailure}
          retry={load}
          backHref="/overview"
          backLabel="Back to Home"
        />
      ) : (
        <Panel>
          <PanelTitle
            title="All activity"
            meta={`${plural(data.length, "recent event")}`}
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
                  <p>{activityMeta(e)}</p>
                </div>
                <time>{formatDateTime(e.created_at)}</time>
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
              <strong>{formatDateTime(selected.created_at)}</strong>
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

/** Second line of an activity row: the event type, unless the title already is the type. */
function activityMeta(e: Event): string {
  const hasTitle = typeof e.payload?.description === "string";
  if (hasTitle) return labelize(e.type);
  const amount = e.payload?.amount;
  const currency = e.payload?.currency;
  return typeof amount === "number"
    ? money(amount, typeof currency === "string" ? currency : undefined)
    : formatDate(e.created_at);
}
