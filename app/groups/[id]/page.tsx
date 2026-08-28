"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  DollarOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  Panel,
  PanelTitle,
} from "../../../components/UI";
import { apiFetch } from "../../../lib/api";
import {
  Debt,
  Expense,
  Group,
  Member,
  money,
  initials,
} from "../../../lib/types";
import { useSession } from "../../../components/SessionProvider";
type GroupBalances = {
  data: { user_id: string; amount: number }[];
  currency: string;
};
type Settlement = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: string;
  note?: string;
  settled_at: string;
};
type Tab = "expenses" | "balances" | "members" | "settlements";
export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const [group, setGroup] = useState<Group>();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances>();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [editingSettlement, setEditingSettlement] = useState<Settlement>();
  const [tab, setTab] = useState<Tab>("expenses");
  const [modal, setModal] = useState<"expense" | "settle" | "member" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [g, m, e, b, d, s] = await Promise.all([
        apiFetch<Group>(`/api/v1/groups/${id}`),
        apiFetch<{ data: Member[] }>(`/api/v1/groups/${id}/members`),
        apiFetch<{ data: Expense[] }>(
          `/api/v1/groups/${id}/expenses?limit=100`,
        ),
        apiFetch<GroupBalances>(`/api/v1/groups/${id}/balances`),
        apiFetch<{ data: Debt[] }>(`/api/v1/groups/${id}/debts`),
        apiFetch<{ data: Settlement[] }>(
          `/api/v1/groups/${id}/settlements?limit=100`,
        ),
      ]);
      setGroup(g);
      setMembers(m.data);
      setExpenses(e.data);
      setBalances(b);
      setDebts(d.data);
      setSettlements(s.data);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to open this group.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const names = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members],
  );
  const visibleExpenses = expenses.filter((expense) =>
    expense.description.toLowerCase().includes(search.toLowerCase()),
  );
  const removeExpense = async (expense: Expense) => {
    if (
      !window.confirm(`Delete “${expense.description}”? This cannot be undone.`)
    )
      return;
    try {
      await apiFetch(`/api/v1/expenses/${expense.id}`, { method: "DELETE" });
      await load();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not delete expense.");
    }
  };
  if (loading)
    return (
      <AppShell title="Group" description="Loading the shared ledger…">
        <Loading />
      </AppShell>
    );
  return (
    <AppShell
      title={group?.name || "Group"}
      eyebrow={`${group?.group_type || "SHARED"} · ${group?.currency || "NPR"}`}
      description={group?.description || "A shared Settlr ledger."}
      actions={
        <div className="top-action-pair">
          <button
            className="button"
            onClick={() => {
              setEditingSettlement(undefined);
              setModal("settle");
            }}
          >
            <SwapOutlined /> Settle up
          </button>
          <button
            className="button primary"
            onClick={() => setModal("expense")}
          >
            <PlusOutlined /> Add expense
          </button>
        </div>
      }
    >
      <div className="detail-toolbar">
        <Link href="/groups" className="back-link">
          <ArrowLeftOutlined /> All groups
        </Link>
        <Link href={`/groups/${id}/manage`} className="text-button">
          <SettingOutlined /> Manage group
        </Link>
      </div>
      {error && <ErrorState message={error} retry={load} />}
      <section className="group-summary">
        <div>
          <span>GROUP SPENDING</span>
          <strong>
            {money(
              expenses.reduce((n, e) => n + e.amount, 0),
              group?.currency,
            )}
          </strong>
          <small>{expenses.length} expenses recorded</small>
        </div>
        <div>
          <span>YOUR BALANCE</span>
          <strong
            className={
              (balances?.data.find((x) => x.user_id === user?.id)?.amount ??
                0) < 0
                ? "negative"
                : ""
            }
          >
            {money(
              balances?.data.find((x) => x.user_id === user?.id)?.amount ?? 0,
              group?.currency,
            )}
          </strong>
          <small>
            {debts.length
              ? `${debts.length} payments to settle`
              : "Everyone is settled"}
          </small>
        </div>
        <div className="member-stack">
          {members.slice(0, 4).map((m) => (
            <i key={m.id}>{initials(m.name)}</i>
          ))}
          <b>{members.length} members</b>
        </div>
      </section>
      <div className="tabs" role="tablist">
        {(["expenses", "balances", "members", "settlements"] as Tab[]).map(
          (x) => (
            <button
              key={x}
              role="tab"
              aria-selected={tab === x}
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ),
        )}
      </div>
      {tab === "expenses" && (
        <Panel>
          <PanelTitle
            title="Expenses"
            meta={`${expenses.length} entries`}
            action={
              <label className="mini-search">
                <SearchOutlined />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search expenses"
                />
              </label>
            }
          />
          {visibleExpenses.map((e) => (
            <article className="expense-line" key={e.id}>
              <span className="expense-category">
                <DollarOutlined />
              </span>
              <div>
                <h3>{e.description}</h3>
                <p>
                  Paid by {names[e.paid_by] || "group member"} ·{" "}
                  {new Date(e.expense_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <strong>{money(e.amount, e.currency)}</strong>
                <small>{(e.split_mode ?? "equal").toLowerCase()} split</small>
              </div>
              <Link
                className="row-action"
                href={`/expenses/${e.id}`}
                aria-label={`Open ${e.description}`}
              >
                <SettingOutlined />
              </Link>
              <button
                className="row-action"
                onClick={() => void removeExpense(e)}
                aria-label={`Delete ${e.description}`}
              >
                <DeleteOutlined />
              </button>
            </article>
          ))}
          {!expenses.length && (
            <Empty
              text="Add the first expense to begin calculating balances."
              action={
                <button
                  className="button primary"
                  onClick={() => setModal("expense")}
                >
                  <PlusOutlined /> Add expense
                </button>
              }
            />
          )}
        </Panel>
      )}
      {tab === "balances" && (
        <Panel>
          <PanelTitle
            title="Suggested repayments"
            meta="Simplified to the fewest useful payments"
            action={
              <button
                className="text-button"
                onClick={() => setModal("settle")}
              >
                <SwapOutlined /> Settle up
              </button>
            }
          />
          {debts.map((d, i) => (
            <article
              className="debt-line"
              key={`${d.from_user}-${d.to_user}-${i}`}
            >
              <span className="avatar soft">
                {initials(names[d.from_user])}
              </span>
              <div>
                <strong>{names[d.from_user]}</strong>
                <p>pays {names[d.to_user]}</p>
              </div>
              <SwapOutlined />
              <strong>{money(d.amount, group?.currency)}</strong>
            </article>
          ))}
          {!debts.length && (
            <Empty
              title="All settled"
              text="There are no outstanding balances in this group."
            />
          )}
        </Panel>
      )}
      {tab === "members" && (
        <Panel>
          <PanelTitle
            title="Members"
            meta={`${members.length} people`}
            action={
              <button
                className="text-button"
                onClick={() => setModal("member")}
              >
                <UserAddOutlined /> Add member
              </button>
            }
          />
          {members.map((m) => (
            <article className="member-line" key={m.id}>
              <span className="avatar soft">{initials(m.name)}</span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.role.toLowerCase()}</small>
              </div>
              <strong
                className={
                  (balances?.data.find((x) => x.user_id === m.id)?.amount ??
                    0) < 0
                    ? "negative"
                    : ""
                }
              >
                {money(
                  balances?.data.find((x) => x.user_id === m.id)?.amount ?? 0,
                  group?.currency,
                )}
              </strong>
            </article>
          ))}
        </Panel>
      )}
      {tab === "settlements" && (
        <Panel>
          <PanelTitle
            title="Settlement history"
            meta={`${settlements.length} recorded payments`}
          />
          {settlements.map((s) => (
            <article className="expense-line" key={s.id}>
              <span className="expense-category">
                <SwapOutlined />
              </span>
              <div>
                <h3>
                  {names[s.from_user]} paid {names[s.to_user]}
                </h3>
                <p>
                  {s.note || "Settlement"} ·{" "}
                  {new Date(s.settled_at).toLocaleDateString()}
                </p>
              </div>
              <strong>{money(s.amount, s.currency)}</strong>
              <button
                className="row-action"
                aria-label={`Edit settlement ${money(s.amount, s.currency)}`}
                onClick={() => {
                  setEditingSettlement(s);
                  setModal("settle");
                }}
              >
                <EditOutlined />
              </button>
              <button
                className="row-action"
                aria-label={`Delete settlement ${money(s.amount, s.currency)}`}
                onClick={() =>
                  confirm("Delete this settlement?") &&
                  void apiFetch(`/api/v1/settlements/${s.id}`, {
                    method: "DELETE",
                  }).then(load)
                }
              >
                <DeleteOutlined />
              </button>
            </article>
          ))}
          {!settlements.length && (
            <Empty text="Payments recorded with Settle up appear here." />
          )}
        </Panel>
      )}
      {modal === "expense" && group && (
        <ExpenseModal
          group={group}
          members={members}
          userId={user!.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
          }}
        />
      )}
      {modal === "settle" && group && (
        <SettlementModal
          group={group}
          members={members}
          debts={debts}
          settlement={editingSettlement}
          onClose={() => {
            setModal(null);
            setEditingSettlement(undefined);
          }}
          onDone={() => {
            setModal(null);
            setEditingSettlement(undefined);
            void load();
          }}
        />
      )}
      {modal === "member" && (
        <MemberModal
          groupId={id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void load();
          }}
        />
      )}
    </AppShell>
  );
}

function ExpenseModal({
  group,
  members,
  userId,
  onClose,
  onDone,
}: {
  group: Group;
  members: Member[];
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES">(
    "EQUAL",
  );
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.id));
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const amount = Math.round(Number(data.get("amount")) * 100);
    const splits = selected.map((uid) => ({
      user_id: uid,
      ...(mode === "EXACT"
        ? { amount: Math.round(Number(values[uid] || 0) * 100) }
        : mode === "PERCENTAGE"
          ? { percentage: Number(values[uid] || 0) }
          : mode === "SHARES"
            ? { shares: Number(values[uid] || 0) }
            : {}),
    }));
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/groups/${group.id}/expenses`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          description: data.get("description"),
          amount,
          currency: data.get("currency"),
          paid_by: data.get("paid_by"),
          category_id: data.get("category_id") || undefined,
          notes: data.get("notes"),
          expense_date: data.get("expense_date"),
          split_mode: mode,
          splits,
        }),
      });
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save expense.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      wide
      title="Add an expense"
      subtitle="Choose participants and a split method. Settlr validates every cent."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Description
            <input
              name="description"
              required
              placeholder="Dinner, rent, taxi…"
            />
          </label>
          <label>
            Amount
            <div className="amount-field">
              <select name="currency" defaultValue={group.currency}>
                <option>{group.currency}</option>
                <option>NPR</option>
                <option>USD</option>
                <option>EUR</option>
                <option>INR</option>
              </select>
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </label>
          <label>
            Paid by
            <select name="paid_by" defaultValue={userId}>
              {members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              name="expense_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
        </div>
        <fieldset>
          <legend>How should it be split?</legend>
          <div className="segmented">
            {(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const).map((x) => (
              <button
                type="button"
                key={x}
                className={mode === x ? "active" : ""}
                onClick={() => setMode(x)}
              >
                {x.toLowerCase()}
              </button>
            ))}
          </div>
          <div className="participant-list">
            {members.map((m) => {
              const checked = selected.includes(m.id);
              return (
                <div key={m.id}>
                  <label className="member-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected(
                          checked
                            ? selected.filter((x) => x !== m.id)
                            : [...selected, m.id],
                        )
                      }
                    />
                    <span className="avatar soft">{initials(m.name)}</span>
                    <strong>{m.name}</strong>
                  </label>
                  {mode !== "EQUAL" && checked && (
                    <input
                      aria-label={`${mode} for ${m.name}`}
                      value={values[m.id] || ""}
                      onChange={(e) =>
                        setValues({ ...values, [m.id]: e.target.value })
                      }
                      type="number"
                      min="0"
                      step={mode === "EXACT" ? ".01" : "1"}
                      placeholder={
                        mode === "EXACT"
                          ? group.currency
                          : mode === "PERCENTAGE"
                            ? "%"
                            : "shares"
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
        <label>
          Notes
          <textarea name="notes" placeholder="Optional details" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="button primary full"
          disabled={busy || !selected.length}
        >
          {busy ? "Saving…" : "Save expense"}
        </button>
      </form>
    </Modal>
  );
}

function SettlementModal({
  group,
  members,
  debts,
  settlement,
  onClose,
  onDone,
}: {
  group: Group;
  members: Member[];
  debts: Debt[];
  settlement?: Settlement;
  onClose: () => void;
  onDone: () => void;
}) {
  const first = debts[0];
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch(
        settlement
          ? `/api/v1/settlements/${settlement.id}`
          : `/api/v1/groups/${group.id}/settlements`,
        {
          method: settlement ? "PATCH" : "POST",
          body: JSON.stringify(
            settlement
              ? {
                  amount: Math.round(Number(d.get("amount")) * 100),
                  note: d.get("note"),
                }
              : {
                  from_user: d.get("from_user"),
                  to_user: d.get("to_user"),
                  amount: Math.round(Number(d.get("amount")) * 100),
                  currency: group.currency,
                  note: d.get("note"),
                  settled_at: new Date().toISOString(),
                },
          ),
        },
      );
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not record settlement.");
    }
  };
  return (
    <Modal
      title={settlement ? "Edit settlement" : "Record a settlement"}
      subtitle="Log a payment that already happened. This updates everyone’s balance."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Who paid?
          <select
            name="from_user"
            defaultValue={settlement?.from_user || first?.from_user}
            disabled={Boolean(settlement)}
          >
            {members.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Who received it?
          <select
            name="to_user"
            defaultValue={settlement?.to_user || first?.to_user}
            disabled={Boolean(settlement)}
          >
            {members.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={
              settlement
                ? settlement.amount / 100
                : first
                  ? first.amount / 100
                  : undefined
            }
            required
          />
        </label>
        <label>
          Note
          <input
            name="note"
            defaultValue={settlement?.note}
            placeholder="Bank transfer, cash…"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full">
          {settlement ? "Save settlement" : "Record settlement"}
        </button>
      </form>
    </Modal>
  );
}
function MemberModal({
  groupId,
  onClose,
  onDone,
}: {
  groupId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/v1/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: d.get("email") }),
      });
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not add member.");
    }
  };
  return (
    <Modal
      title="Add a group member"
      subtitle="Invite an existing Settlr user by email."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            placeholder="friend@example.com"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full">
          <UserAddOutlined /> Add member
        </button>
      </form>
    </Modal>
  );
}
