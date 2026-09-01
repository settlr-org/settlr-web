"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightOutlined,
  DollarOutlined,
  PlusOutlined,
  SwapOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  Panel,
  PanelTitle,
} from "../../components/UI";
import { apiFetch, readApiCache } from "../../lib/api";
import { useSession } from "../../components/SessionProvider";
import {
  Balance,
  Category,
  Debt,
  Event,
  Friend,
  Group,
  Member,
  labelize,
  money,
  initials,
} from "../../lib/types";
export default function Overview() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cachedBalance = readApiCache<Balance>("/api/v1/me/balances");
  const cachedEvents = readApiCache<{ data: Event[] }>(
    "/api/v1/activity?limit=6",
  );
  const cachedFriends = readApiCache<{ data: Friend[] }>("/api/v1/friends");
  const cachedGroups = readApiCache<{ data: Group[] }>("/api/v1/groups");
  const warm = Boolean(
    cachedBalance && cachedEvents && cachedFriends && cachedGroups,
  );
  const [balance, setBalance] = useState<Balance | undefined>(cachedBalance);
  const [events, setEvents] = useState<Event[]>(cachedEvents?.data ?? []);
  const [friends, setFriends] = useState<Friend[]>(cachedFriends?.data ?? []);
  const [groups, setGroups] = useState<Group[]>(cachedGroups?.data ?? []);
  const [friendBalances, setFriendBalances] = useState<
    Record<string, { amount: number; currency: string } | null>
  >({});
  const [loading, setLoading] = useState(!warm);
  const [error, setError] = useState("");
  const [addExpense, setAddExpense] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const load = useCallback(async () => {
    if (!warm) setLoading(true);
    setError("");
    try {
      const [b, a, f, g] = await Promise.all([
        apiFetch<Balance>("/api/v1/me/balances"),
        apiFetch<{ data: Event[] }>("/api/v1/activity?limit=6"),
        apiFetch<{ data: Friend[] }>("/api/v1/friends"),
        apiFetch<{ data: Group[] }>("/api/v1/groups"),
      ]);
      setBalance(b);
      setEvents(a.data);
      setFriends(f.data);
      setGroups(g.data);
      if (user?.id) {
        const entries = await Promise.all(
          f.data.map(async (friend) => {
            try {
              const position = await apiFetch<{
                amount: number;
                currency: string;
              }>(`/api/v1/friends/${friend.user_id}/balance`);
              return [friend.user_id, position] as const;
            } catch {
              return [friend.user_id, null] as const;
            }
          }),
        );
        setFriendBalances(Object.fromEntries(entries));
      }
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to load overview.");
    } finally {
      setLoading(false);
    }
  }, [balance?.currency, user?.id, warm]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    setAddExpense(true);
    router.replace("/overview");
  }, [router, searchParams]);
  return (
    <AppShell
      title="Overview"
      description="Every shared balance, one clear next move."
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          {error && <ErrorState message={error} retry={load} />}
          <section className="summary-grid">
            <article className="balance-card">
              <div className="card-title">
                <span>NET POSITION</span>
                <WalletOutlined />
              </div>
              <strong
                className={
                  (balance?.summary.net_balance ?? 0) < 0 ? "negative" : ""
                }
              >
                {money(balance?.summary.net_balance ?? 0, balance?.currency)}
              </strong>
              <p>Across {balance?.data.length ?? 0} active groups</p>
              <div className="balance-split">
                <div>
                  <span>YOU ARE OWED</span>
                  <b>
                    {money(
                      balance?.summary.you_are_owed ?? 0,
                      balance?.currency,
                    )}
                  </b>
                </div>
                <div>
                  <span>YOU OWE</span>
                  <b className="negative">
                    {money(balance?.summary.you_owe ?? 0, balance?.currency)}
                  </b>
                </div>
              </div>
            </article>
            <article className="quick-card">
              <p className="eyebrow">QUICK ACTIONS</p>
              <button type="button" onClick={() => setAddExpense(true)}>
                <PlusOutlined />
                <b>Add expense</b>
                <span>Split with a group</span>
              </button>
              <button type="button" onClick={() => setSettleOpen(true)}>
                <SwapOutlined />
                <b>Settle up</b>
                <span>Record a payment</span>
              </button>
              <button type="button" onClick={() => setGroupOpen(true)}>
                <TeamOutlined />
                <b>New group</b>
                <span>Start a shared ledger</span>
              </button>
            </article>
          </section>
          <section className="dashboard-grid">
            <Panel>
              <PanelTitle
                title="Recent activity"
                meta="The latest changes across your groups"
                action={
                  <Link className="text-button" href="/activity">
                    View all <ArrowRightOutlined />
                  </Link>
                }
              />
              {events.map((e) => (
                <div className="event-row" key={e.id}>
                  <span className="event-icon">
                    <DollarOutlined />
                  </span>
                  <div>
                    <strong>
                      {typeof e.payload?.description === "string"
                        ? e.payload.description
                        : labelize(e.type)}
                    </strong>
                    <small>{labelize(e.type)}</small>
                  </div>
                  <time>
                    {new Date(e.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              ))}
              {!events.length && (
                <Empty
                  icon={<UnorderedListOutlined />}
                  text="Add an expense or create a group to begin your history."
                />
              )}
            </Panel>
            <Panel>
              <PanelTitle
                title="Friends"
                meta={`${friends.length} connected`}
                action={
                  <Link className="text-button" href="/friends">
                    Manage
                  </Link>
                }
              />
              {friends.slice(0, 5).map((f) =>
                (() => {
                  const position = friendBalances[f.user_id];
                  const amount = position?.amount;
                  const balanceLabel =
                    amount === undefined
                      ? "Balance unavailable"
                      : amount > 0
                        ? `Owed ${money(amount, position?.currency)}`
                        : amount < 0
                          ? `You owe ${money(Math.abs(amount), position?.currency)}`
                          : "Settled up";
                  return (
                    <Link
                      href={`/friends?user=${f.user_id}`}
                      className="person-row"
                      key={f.user_id}
                    >
                      <span className="avatar soft">{initials(f.name)}</span>
                      <div>
                        <strong>{f.name}</strong>
                        <small
                          className={
                            amount === undefined
                              ? "muted"
                              : amount < 0
                                ? "negative"
                                : "positive"
                          }
                        >
                          {balanceLabel}
                        </small>
                      </div>
                      <ArrowRightOutlined />
                    </Link>
                  );
                })(),
              )}
              {!friends.length && (
                <Empty
                  icon={<TeamOutlined />}
                  text="Find friends to create a direct shared ledger."
                />
              )}
            </Panel>
          </section>
          <Panel className="group-strip">
            <PanelTitle
              title="Active groups"
              meta={`${groups.length} ledgers`}
            />
            <div className="group-grid">
              {groups.slice(0, 4).map((g) => {
                const b = balance?.data.find((x) => x.group_id === g.id);
                return (
                  <Link
                    href={`/groups/${g.id}`}
                    className="group-card"
                    key={g.id}
                  >
                    <span className="group-icon">
                      <TeamOutlined />
                    </span>
                    <div>
                      <p>
                        {g.group_type} · {g.currency}
                      </p>
                      <h3>{g.name}</h3>
                      <span>{g.description || "Shared Settlr ledger"}</span>
                    </div>
                    <strong className={(b?.balance ?? 0) < 0 ? "negative" : ""}>
                      {money(b?.balance ?? 0, g.currency)}
                    </strong>
                  </Link>
                );
              })}
            </div>
          </Panel>
          {addExpense && (
            <QuickExpenseModal
              groups={groups}
              userId={user?.id || ""}
              onClose={() => setAddExpense(false)}
              onDone={() => {
                setAddExpense(false);
                void load();
              }}
              onNeedGroup={() => {
                setAddExpense(false);
                setGroupOpen(true);
              }}
            />
          )}
          {settleOpen && (
            <QuickSettleModal
              groups={groups}
              onClose={() => setSettleOpen(false)}
              onDone={() => {
                setSettleOpen(false);
                void load();
              }}
              onNeedGroup={() => {
                setSettleOpen(false);
                setGroupOpen(true);
              }}
            />
          )}
          {groupOpen && (
            <QuickGroupModal
              onClose={() => setGroupOpen(false)}
              onDone={() => {
                setGroupOpen(false);
                void load();
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function QuickExpenseModal({
  groups,
  userId,
  onClose,
  onDone,
  onNeedGroup,
}: {
  groups: Group[];
  userId: string;
  onClose: () => void;
  onDone: () => void;
  onNeedGroup: () => void;
}) {
  const [kind, setKind] = useState<"choose" | "shared">("choose");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES">(
    "EQUAL",
  );
  const [paidBy, setPaidBy] = useState(userId);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState(
    groups.find((g) => g.id === groupId)?.currency || "NPR",
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Category[] }>("/api/v1/categories")
      .then((r) => setCategories(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const grp = groups.find((g) => g.id === groupId);
    if (grp) setCurrency(grp.currency);
    apiFetch<{ data: Member[] }>(`/api/v1/groups/${groupId}/members`)
      .then((result) => {
        setMembers(result.data);
        setSelected(result.data.map((m) => m.id));
        if (!result.data.some((m) => m.id === paidBy)) {
          setPaidBy(result.data[0]?.id || userId);
        }
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load group members.",
        ),
      );
  }, [groupId, groups, paidBy, userId]);

  useEffect(() => {
    if (groups.length && !groupId) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawAmount = data.get("amount");
    const description = String(data.get("description") || "").trim();
    const amount = Math.round(Number(rawAmount) * 100);
    if (!groupId || !description || !Number.isFinite(amount) || amount <= 0) {
      setError("Choose a group and enter a description and amount.");
      return;
    }
    if (!selected.length) {
      setError("Select at least one participant.");
      return;
    }
    if (mode !== "EQUAL") {
      for (const uid of selected) {
        const v = values[uid];
        if (
          v === undefined ||
          v === "" ||
          Number.isNaN(Number(v)) ||
          Number(v) <= 0
        ) {
          setError(
            `Enter a valid ${mode.toLowerCase()} value for every participant.`,
          );
          return;
        }
      }
    }
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
      await apiFetch(`/api/v1/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          description,
          amount,
          currency: String(data.get("currency") || currency),
          paid_by: String(data.get("paid_by") || paidBy),
          category_id: (data.get("category_id") as string) || undefined,
          notes: notes || undefined,
          expense_date: String(data.get("expense_date") || expenseDate),
          split_mode: mode,
          splits,
        }),
      });
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save expense.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!groups.length) {
    return (
      <Modal
        title="Add expense"
        subtitle="You need a group before you can split an expense."
        onClose={onClose}
      >
        <div className="stack-form">
          <p className="muted-copy">
            Create a shared ledger first, then add expenses with equal, exact,
            percentage, or shares splits.
          </p>
          <button className="button primary" onClick={onNeedGroup}>
            <TeamOutlined /> Create a group
          </button>
        </div>
      </Modal>
    );
  }

  if (kind === "choose")
    return (
      <Modal
        title="Add expense"
        subtitle="Choose where this expense belongs."
        onClose={onClose}
      >
        <div className="stack-form">
          <button className="button primary" onClick={() => setKind("shared")}>
            <TeamOutlined /> Shared expense
          </button>
          <Link className="button" href="/personal?new=1">
            <WalletOutlined /> Personal expense
          </Link>
        </div>
      </Modal>
    );
  return (
    <Modal
      wide
      title="Add shared expense"
      subtitle="Choose a group, payer, date, and how to split. Supports equal, exact, percentage, and shares."
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={save}>
        <label>
          Group
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            required
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.currency}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Description
            <input
              name="description"
              required
              placeholder="Dinner, taxi, groceries…"
            />
          </label>
          <label>
            Amount
            <div className="amount-field">
              <select
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="NPR">NPR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
              </select>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
              />
            </div>
          </label>
          <label>
            Paid by
            <select
              name="paid_by"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
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
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
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
                      step={mode === "EXACT" ? "0.01" : "1"}
                      placeholder={
                        mode === "EXACT"
                          ? currency
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
          Category
          <select name="category_id" defaultValue="">
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            placeholder="Optional details"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => setKind("choose")}
          >
            Back
          </button>
          <button
            className="button primary"
            disabled={busy || !selected.length}
            style={{ flex: 1 }}
          >
            {busy ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QuickSettleModal({
  groups,
  onClose,
  onDone,
  onNeedGroup,
}: {
  groups: Group[];
  onClose: () => void;
  onDone: () => void;
  onNeedGroup: () => void;
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [members, setMembers] = useState<Member[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [fromUser, setFromUser] = useState("");
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    Promise.all([
      apiFetch<{ data: Member[] }>(`/api/v1/groups/${groupId}/members`),
      apiFetch<{ data: Debt[] }>(`/api/v1/groups/${groupId}/debts`),
    ])
      .then(([m, d]) => {
        setMembers(m.data);
        setDebts(d.data);
        const first = d.data[0];
        if (first) {
          setFromUser(first.from_user);
          setToUser(first.to_user);
          setAmount(String(first.amount / 100));
        } else if (m.data.length >= 2) {
          setFromUser(m.data[0].id);
          setToUser(m.data[1].id);
        }
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load group.",
        ),
      );
  }, [groupId]);

  useEffect(() => {
    if (groups.length && !groupId) setGroupId(groups[0].id);
  }, [groups, groupId]);

  if (!groups.length) {
    return (
      <Modal
        title="Settle up"
        subtitle="You need a group with balances to record a payment."
        onClose={onClose}
      >
        <div className="stack-form">
          <p className="muted-copy">
            Create a group and add expenses first — settlements clear the
            suggested repayments.
          </p>
          <button className="button primary" onClick={onNeedGroup}>
            <TeamOutlined /> Create a group
          </button>
        </div>
      </Modal>
    );
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amt = Math.round(Number(amount) * 100);
    if (!groupId || !fromUser || !toUser || !Number.isFinite(amt) || amt <= 0) {
      setError("Choose a group, payer, recipient, and positive amount.");
      return;
    }
    if (fromUser === toUser) {
      setError("Payer and recipient must be different.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const grp = groups.find((g) => g.id === groupId);
      await apiFetch(`/api/v1/groups/${groupId}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          from_user: fromUser,
          to_user: toUser,
          amount: amt,
          currency: grp?.currency || "NPR",
          note: note || undefined,
          settled_at: new Date().toISOString(),
        }),
      });
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not record settlement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Settle up"
      subtitle="Record a payment that already happened. This updates everyone’s balance."
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label>
          Group
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            required
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {g.currency}
              </option>
            ))}
          </select>
        </label>
        {debts.length > 0 && (
          <div className="success-note">
            Suggested:{" "}
            {debts[0] &&
              (() => {
                const fromName =
                  members.find((m) => m.id === debts[0].from_user)?.name ??
                  debts[0].from_user;
                const toName =
                  members.find((m) => m.id === debts[0].to_user)?.name ??
                  debts[0].to_user;
                return `${fromName} pays ${toName} ${money(debts[0].amount, groups.find((g) => g.id === groupId)?.currency)}`;
              })()}
          </div>
        )}
        <div className="form-grid">
          <label>
            Who paid?
            <select
              value={fromUser}
              onChange={(e) => setFromUser(e.target.value)}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Who received it?
            <select
              value={toUser}
              onChange={(e) => setToUser(e.target.value)}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Amount ({groups.find((g) => g.id === groupId)?.currency || "NPR"})
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bank transfer, cash…"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={busy}>
          {busy ? "Saving…" : "Record settlement"}
        </button>
      </form>
    </Modal>
  );
}

function QuickGroupModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      setError("Group name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch<{ id: string }>("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: data.get("description"),
          currency: data.get("currency"),
          group_type: data.get("group_type"),
          information: data.get("information"),
        }),
      });
      onDone();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Create a new group"
      subtitle="Choose a clear name and currency. You can invite people next."
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label>
          Group name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Pokhara weekend"
          />
        </label>
        <label>
          Description
          <input name="description" placeholder="What is this group for?" />
        </label>
        <div className="form-grid">
          <label>
            Currency
            <select name="currency" defaultValue="NPR">
              <option>NPR</option>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>INR</option>
              <option>AUD</option>
              <option>CAD</option>
            </select>
          </label>
          <label>
            Group type
            <select name="group_type" defaultValue="OTHER">
              <option value="TRIP">Trip</option>
              <option value="HOME">Home</option>
              <option value="COUPLE">Couple</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>
        <label>
          Group information
          <textarea
            name="information"
            placeholder="House rules, payment details, or useful context"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={busy}>
          {busy ? "Creating…" : "Create group"}
        </button>
      </form>
    </Modal>
  );
}
