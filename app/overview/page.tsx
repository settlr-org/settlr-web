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
  Event,
  Friend,
  Group,
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
              <button onClick={() => setAddExpense(true)}>
                <PlusOutlined />
                <b>Add expense</b>
              </button>
              <Link href="/groups">
                <SwapOutlined />
                <b>Settle up</b>
                <span>Record a payment</span>
              </Link>
              <Link href="/groups?create=1">
                <TeamOutlined />
                <b>New group</b>
                <span>Start a shared ledger</span>
              </Link>
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
                            amount !== undefined && amount < 0
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
}: {
  groups: Group[];
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"choose" | "shared">("choose");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!groupId) return;
    apiFetch<{ data: { id: string; name: string }[] }>(
      `/api/v1/groups/${groupId}/members`,
    )
      .then((result) => setMembers(result.data))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load group members.",
        ),
      );
  }, [groupId]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Math.round(Number(data.get("amount")) * 100);
    if (
      !groupId ||
      !data.get("description") ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Choose a group and enter a description and amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Idempotency-Key": `${Date.now()}-${Math.random()}` },
        body: JSON.stringify({
          description: data.get("description"),
          amount,
          currency:
            groups.find((group) => group.id === groupId)?.currency || "NPR",
          paid_by: userId,
          expense_date: new Date().toISOString().slice(0, 10),
          split_mode: "EQUAL",
          splits: members.map((member) => ({ user_id: member.id })),
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
      title="Add shared expense"
      subtitle="Split equally with the selected group."
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
                {group.name}
              </option>
            ))}
          </select>
        </label>
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
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary" disabled={busy || !members.length}>
          {busy ? "Saving…" : "Save expense"}
        </button>
      </form>
    </Modal>
  );
}
