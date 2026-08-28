"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  DeleteOutlined,
  DownloadOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  TeamOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../../../components/UI";
import { apiDownload, apiFetch } from "../../../../lib/api";
import {
  Event,
  Group,
  Member,
  initials,
  labelize,
  money,
} from "../../../../lib/types";
import { useSession } from "../../../../components/SessionProvider";

type Invite = {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
};
type Recurring = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  frequency: string;
  next_run_at: string;
  active: boolean;
};
type Stats = {
  total_spent: number;
  average_expense: number;
  expense_count: number;
  by_category: { category: string; total: number; count: number }[];
  by_member: {
    user_id: string;
    name: string;
    total_paid: number;
    count: number;
  }[];
};

export default function ManageGroup() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [group, setGroup] = useState<Group>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [g, m, i, r, s, a] = await Promise.all([
        apiFetch<Group>(`/api/v1/groups/${id}`),
        apiFetch<{ data: Member[] }>(`/api/v1/groups/${id}/members`),
        apiFetch<{ data: Invite[] }>(`/api/v1/groups/${id}/invites`),
        apiFetch<{ data: Recurring[] }>(`/api/v1/groups/${id}/recurring`),
        apiFetch<Stats>(`/api/v1/groups/${id}/stats?range=all`),
        apiFetch<{ data: Event[] }>(`/api/v1/groups/${id}/activity?limit=20`),
      ]);
      setGroup(g);
      setMembers(m.data);
      setInvites(i.data);
      setRecurring(r.data);
      setStats(s);
      setEvents(a.data);
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Could not load group controls.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const myRole = useMemo(
    () => members.find((member) => member.id === user?.id)?.role,
    [members, user],
  );
  const admin = myRole === "OWNER" || myRole === "ADMIN";
  const update = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/v1/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
          currency: data.get("currency"),
          group_type: data.get("group_type"),
          information: data.get("information"),
          simplify_debts: data.get("simplify_debts") === "on",
        }),
      });
      setSaved("Group settings saved.");
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save group.");
    }
  };
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    try {
      await apiFetch(`/api/v1/groups/${id}/invites`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      form.reset();
      setSaved(`Invitation sent to ${email}.`);
      await load();
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Could not invite this person.",
      );
    }
  };
  const createRecurring = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiFetch(`/api/v1/groups/${id}/recurring`, {
        method: "POST",
        body: JSON.stringify({
          description: data.get("description"),
          amount: Math.round(Number(data.get("amount")) * 100),
          currency: group?.currency,
          paid_by: data.get("paid_by"),
          frequency: data.get("frequency"),
          start_date: data.get("start_date"),
          split_mode: "EQUAL",
          splits: members.map((member) => ({ user_id: member.id })),
        }),
      });
      form.reset();
      setSaved("Recurring expense created.");
      await load();
    } catch (x) {
      setError(
        x instanceof Error ? x.message : "Could not create recurring expense.",
      );
    }
  };
  const action = async (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: object,
  ) => {
    try {
      await apiFetch(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Action failed.");
    }
  };
  const leaveOrRemove = async (kind: "archive" | "delete" | "leave") => {
    if (!confirm(`${labelize(kind)} “${group?.name}”?`)) return;
    try {
      if (kind === "archive")
        await apiFetch(`/api/v1/groups/${id}/archive`, { method: "POST" });
      else if (kind === "delete")
        await apiFetch(`/api/v1/groups/${id}`, { method: "DELETE" });
      else await apiFetch(`/api/v1/groups/${id}/leave`, { method: "POST" });
      router.replace("/groups");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not complete action.");
    }
  };
  if (loading || !group)
    return (
      <AppShell title="Manage group" description="Loading group controls…">
        <Loading />
      </AppShell>
    );
  return (
    <AppShell
      title={`Manage ${group.name}`}
      eyebrow="GROUP CONTROL ROOM"
      description="Membership, invitations, recurring costs, reports, and ledger settings."
    >
      <div className="detail-toolbar">
        <Link href={`/groups/${id}`} className="back-link">
          <ArrowLeftOutlined /> Back to ledger
        </Link>
        <span className="status-pill">{myRole?.toLowerCase()}</span>
      </div>
      {error && <ErrorState message={error} retry={load} />}
      {saved && (
        <p className="success-note" role="status">
          {saved}
        </p>
      )}
      <div className="management-grid">
        <Panel>
          <PanelTitle
            title="Ledger settings"
            meta="The details everyone sees"
            action={<SettingOutlined />}
          />
          <form className="stack-form" onSubmit={update}>
            <label>
              Name
              <input
                name="name"
                defaultValue={group.name}
                required
                disabled={!admin}
              />
            </label>
            <div className="form-grid">
              <label>
                Currency
                <select
                  name="currency"
                  defaultValue={group.currency}
                  disabled={!admin}
                >
                  {["NPR", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Group type
                <select
                  name="group_type"
                  defaultValue={group.group_type}
                  disabled={!admin}
                >
                  {["HOME", "TRIP", "COUPLE", "OTHER"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <input
                name="description"
                defaultValue={group.description}
                disabled={!admin}
              />
            </label>
            <label>
              Group information
              <textarea
                name="information"
                defaultValue={group.information}
                disabled={!admin}
              />
            </label>
            <label className="check-label">
              <input
                name="simplify_debts"
                type="checkbox"
                defaultChecked={group.simplify_debts}
                disabled={!admin}
              />{" "}
              Simplify repayments
            </label>
            {admin && (
              <button className="button primary">Save group settings</button>
            )}
          </form>
        </Panel>
        <Panel>
          <PanelTitle
            title="Invite by email"
            meta={`${invites.length} pending`}
            action={<MailOutlined />}
          />
          <form className="inline-form" onSubmit={invite}>
            <input
              name="email"
              type="email"
              required
              placeholder="friend@example.com"
            />
            <button className="button primary">
              <SendOutlined /> Invite
            </button>
          </form>
          {invites.map((item) => (
            <article className="compact-line" key={item.id}>
              <MailOutlined />
              <div>
                <strong>{item.email}</strong>
                <small>
                  Expires {new Date(item.expires_at).toLocaleDateString()}
                </small>
              </div>
              <span className="status-pill">Pending</span>
            </article>
          ))}
        </Panel>
        <Panel>
          <PanelTitle
            title="Members"
            meta={`${members.length} people`}
            action={<TeamOutlined />}
          />
          {members.map((member) => (
            <article className="member-line" key={member.id}>
              <span className="avatar soft">{initials(member.name)}</span>
              <div>
                <strong>{member.name}</strong>
                <small>{member.role.toLowerCase()}</small>
              </div>
              {admin && member.id !== user?.id && (
                <>
                  <select
                    aria-label={`Role for ${member.name}`}
                    value={member.role}
                    onChange={(e) =>
                      void action(
                        `/api/v1/groups/${id}/members/${member.id}`,
                        "PATCH",
                        { role: e.target.value },
                      )
                    }
                  >
                    <option>MEMBER</option>
                    <option>ADMIN</option>
                  </select>
                  <button
                    className="row-action"
                    aria-label={`Remove ${member.name}`}
                    onClick={() =>
                      confirm(`Remove ${member.name}?`) &&
                      void action(
                        `/api/v1/groups/${id}/members/${member.id}`,
                        "DELETE",
                      )
                    }
                  >
                    <UserDeleteOutlined />
                  </button>
                </>
              )}
            </article>
          ))}
        </Panel>
        <Panel>
          <PanelTitle
            title="Recurring expenses"
            meta={`${recurring.length} schedules`}
          />
          <form className="stack-form compact-form" onSubmit={createRecurring}>
            <div className="form-grid">
              <label>
                Description
                <input name="description" required placeholder="Monthly rent" />
              </label>
              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                />
              </label>
              <label>
                Paid by
                <select name="paid_by">
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frequency
                <select name="frequency">
                  <option>MONTHLY</option>
                  <option>WEEKLY</option>
                  <option>DAILY</option>
                  <option>YEARLY</option>
                </select>
              </label>
              <label>
                First run
                <input
                  name="start_date"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>
            <button className="button primary">Create schedule</button>
          </form>
          {recurring.map((item) => (
            <article className="compact-line" key={item.id}>
              <span>
                <strong>{item.description}</strong>
                <small>
                  {money(item.amount, item.currency)} ·{" "}
                  {item.frequency.toLowerCase()}
                </small>
              </span>
              <button
                className="row-action"
                aria-label={`${item.active ? "Pause" : "Resume"} ${item.description}`}
                onClick={() =>
                  void action(`/api/v1/recurring/${item.id}`, "PATCH", {
                    active: !item.active,
                  })
                }
              >
                {item.active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              </button>
              <button
                className="row-action"
                aria-label={`Delete ${item.description}`}
                onClick={() =>
                  confirm(`Delete ${item.description}?`) &&
                  void action(`/api/v1/recurring/${item.id}`, "DELETE")
                }
              >
                <DeleteOutlined />
              </button>
            </article>
          ))}
        </Panel>
        <Panel>
          <PanelTitle
            title="Spending report"
            meta="All-time ledger totals"
            action={<BarChartOutlined />}
          />
          {stats && (
            <>
              <div className="stats-strip">
                <div>
                  <span>Total spent</span>
                  <strong>{money(stats.total_spent, group.currency)}</strong>
                </div>
                <div>
                  <span>Average</span>
                  <strong>
                    {money(stats.average_expense, group.currency)}
                  </strong>
                </div>
                <div>
                  <span>Expenses</span>
                  <strong>{stats.expense_count}</strong>
                </div>
              </div>
              {stats.by_category.map((row) => (
                <article className="compact-line" key={row.category}>
                  <strong>{row.category}</strong>
                  <span>{row.count} entries</span>
                  <b>{money(row.total, group.currency)}</b>
                </article>
              ))}
            </>
          )}
          <div className="button-row">
            <button
              className="button"
              onClick={() =>
                void apiDownload(
                  `/api/v1/groups/${id}/export.csv`,
                  `${group.name}.csv`,
                )
              }
            >
              <DownloadOutlined /> CSV
            </button>
            <button
              className="button"
              onClick={() =>
                void apiDownload(
                  `/api/v1/groups/${id}/export.json`,
                  `${group.name}.json`,
                )
              }
            >
              <DownloadOutlined /> JSON
            </button>
          </div>
        </Panel>
        <Panel>
          <PanelTitle
            title="Group activity"
            meta={`${events.length} recent changes`}
          />
          {events.map((event) => (
            <article className="compact-line" key={event.id}>
              <span>
                <strong>{labelize(event.type)}</strong>
                <small>{new Date(event.created_at).toLocaleString()}</small>
              </span>
            </article>
          ))}
          {!events.length && <Empty text="Group changes will appear here." />}
        </Panel>
      </div>
      <Panel className="danger-zone">
        <PanelTitle
          title="Danger zone"
          meta="These actions change access to the ledger"
          action={<StopOutlined />}
        />
        <div className="button-row">
          {admin && (
            <button
              className="button danger"
              onClick={() => void leaveOrRemove("archive")}
            >
              Archive group
            </button>
          )}{" "}
          {admin && (
            <button
              className="button danger"
              onClick={() => void leaveOrRemove("delete")}
            >
              Delete group
            </button>
          )}{" "}
          {myRole !== "OWNER" && (
            <button
              className="button danger"
              onClick={() => void leaveOrRemove("leave")}
            >
              Leave group
            </button>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
