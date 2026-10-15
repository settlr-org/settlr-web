"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import { useSession } from "../../../components/SessionProvider";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../../components/UI";
import { apiFetch } from "../../../lib/api";
import { formatMoney, Page } from "../../../lib/wallet";
import {
  cadenceLabel,
  dueLabel,
  isOverdue,
  PayResult,
  PlannedItem,
  PlannedPayment,
  planStatus,
  splitPlans,
} from "../../../lib/planning";
import {
  accountMap,
  categoryMap,
  errorText,
  useWalletRefs,
  walletWrite,
} from "../../../components/wallet/data";
import { PlanTabs } from "../../../components/wallet/PlanTabs";
import { PlanFormModal } from "../../../components/wallet/PlanForm";
import { PayDialog } from "../../../components/wallet/PlannedPanel";
import { TransactionEditor } from "../../../components/wallet/TransactionEditor";
import { ItemTile } from "../../../components/wallet/icons";

type Row = {
  key: string;
  plan?: PlannedPayment;
  item: PlannedItem | null;
  name: string;
  status: string;
  late: boolean;
  type: PlannedItem["type"];
  amount: number;
  currency: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  muted: boolean;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default function PlannedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refs, error: refsError, reload } = useWalletRefs();
  const [plans, setPlans] = useState<PlannedPayment[]>();
  const [singles, setSingles] = useState<PlannedItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editingPlan, setEditingPlan] = useState<string | "new" | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [paying, setPaying] = useState<PlannedItem>();
  const [busy, setBusy] = useState("");
  const { user } = useSession();
  const baseCurrency = user?.default_currency || "NPR";

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<{ data: PlannedPayment[] }>("/api/v1/planned"),
      apiFetch<Page<PlannedItem>>(
        "/api/v1/transactions?planned=true&limit=200",
      ),
    ])
      .then(([p, t]) => {
        if (cancelled) return;
        setPlans(p.data);
        // Standalone planned items: unpaid transactions that belong to no plan.
        setSingles(t.data.filter((i) => !i.planned_payment_id));
      })
      .catch(
        (cause) =>
          !cancelled &&
          setError(errorText(cause, "Could not load planned payments.")),
      );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // /wallet/planned?new=1 opens the form (link from the wallet's empty state).
  useEffect(() => {
    if (searchParams.get("new") !== "1" || !refs) return;
    setEditingPlan("new");
    router.replace("/wallet/planned");
  }, [searchParams, refs, router]);

  const refresh = useCallback((message?: string) => {
    if (message) setNotice(message);
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  const skip = async (row: Row) => {
    if (!row.item) return;
    setBusy(row.key);
    try {
      const result = await walletWrite<PayResult>(
        `/api/v1/transactions/${row.item.id}/skip`,
        "POST",
      );
      refresh(
        `Skipped “${row.name}”.${result.next?.due_at ? ` Next due ${shortDate(result.next.due_at)}.` : ""}`,
      );
    } catch (cause) {
      setError(errorText(cause, "Could not skip it."));
    } finally {
      setBusy("");
    }
  };

  const now = new Date();
  const { recurring, oneTime } = useMemo(
    () => splitPlans(plans ?? []),
    [plans],
  );
  const toRow = (p: PlannedPayment): Row => ({
    key: p.id,
    plan: p,
    item: p.next ? { ...p.next, plan: { ...p, id: p.id } } : null,
    name: p.title || "Planned payment",
    status: planStatus(p, now),
    late: p.active && isOverdue(p.next_due_at, now),
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    accountId: p.account_id,
    toAccountId: p.to_account_id,
    categoryId: p.category_id,
    muted: !p.active,
  });
  const singleRows: Row[] = singles.map((i) => ({
    key: i.id,
    item: i,
    name: i.title || "Planned payment",
    status: dueLabel(i.due_at, now),
    late: isOverdue(i.due_at, now),
    type: i.type,
    amount: i.amount,
    currency: i.currency,
    accountId: i.account_id,
    toAccountId: i.to_account_id,
    categoryId: i.category_id,
    muted: false,
  }));
  const oneTimeRows = [...oneTime.map(toRow), ...singleRows].sort(
    (a, b) =>
      Number(a.muted) - Number(b.muted) ||
      new Date(a.item?.due_at ?? 0).getTime() -
        new Date(b.item?.due_at ?? 0).getTime(),
  );

  const accountsById = useMemo(() => accountMap(refs?.accounts ?? []), [refs]);
  const categoriesById = useMemo(
    () => categoryMap(refs?.categories ?? []),
    [refs],
  );

  const list = (rows: Row[], label: string) => (
    <ul className="planned-list" aria-label={label}>
      {rows.map((row) => {
        const category = row.categoryId
          ? categoriesById[row.categoryId]
          : undefined;
        const from = row.accountId
          ? accountsById[row.accountId]?.name
          : undefined;
        const to = row.toAccountId
          ? accountsById[row.toAccountId]?.name
          : undefined;
        const where =
          row.type === "TRANSFER"
            ? `${from ?? "—"} → ${to ?? "—"}`
            : (from ?? "No account yet");
        const sign =
          row.type === "INCOME"
            ? "+"
            : row.type === "EXPENSE"
              ? "-"
              : undefined;
        const dir =
          row.type === "INCOME"
            ? "in"
            : row.type === "EXPENSE"
              ? "out"
              : "neutral";
        const cadence = row.plan ? cadenceLabel(row.plan) : "One-time";
        return (
          <li
            key={row.key}
            className={[
              "planned-row",
              row.late ? "is-late" : "",
              row.muted ? "is-muted" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {category ? (
              <ItemTile icon={category.icon} color={category.color} />
            ) : (
              <span className="planned-icon" aria-hidden="true">
                <CalendarOutlined />
              </span>
            )}
            <span className="planned-main">
              <button
                type="button"
                className="ledger-open"
                aria-label={`Edit ${row.name}`}
                onClick={() =>
                  row.plan
                    ? setEditingPlan(row.plan.id)
                    : setEditingItem(row.key)
                }
              >
                {row.name}
              </button>
              <small>
                {row.plan && !row.plan.one_time ? `${cadence} · ` : ""}
                <span className={row.late ? "planned-late" : undefined}>
                  {row.status}
                </span>
                {" · "}
                {where}
                {category ? ` · ${category.name}` : ""}
              </small>
            </span>
            <span
              className={`planned-amount amount-${row.muted ? "neutral" : dir}`}
            >
              {formatMoney(row.amount, row.currency, { sign })}
            </span>
            <span className="planned-actions">
              {row.item && (
                <>
                  <button
                    type="button"
                    className="button pill-button"
                    disabled={Boolean(busy)}
                    aria-label={`${row.type === "INCOME" ? "Receive" : "Pay"} ${row.name}`}
                    onClick={() => setPaying(row.item!)}
                  >
                    {row.type === "INCOME" ? "Receive" : "Pay"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={Boolean(busy)}
                    aria-label={`Skip ${row.name}`}
                    onClick={() => void skip(row)}
                  >
                    {busy === row.key ? "Skipping…" : "Skip"}
                  </button>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <AppShell
      title="Planned payments"
      eyebrow="WALLET · PLAN"
      description="Rent, salary and subscriptions waiting to be paid — pay or skip each one."
      actions={
        <button
          className="button primary"
          disabled={!refs}
          onClick={() => setEditingPlan("new")}
        >
          <PlusOutlined /> Plan a payment
        </button>
      }
    >
      <PlanTabs />
      {!refs ? (
        refsError ? (
          <ErrorState message={refsError} retry={() => void reload()} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          {error && <ErrorState message={error} retry={() => refresh()} />}
          {notice && (
            <div className="success-banner" role="status">
              {notice}
            </div>
          )}
          {!plans ? (
            !error && <Loading />
          ) : !plans.length && !singles.length ? (
            <Panel>
              <Empty
                icon={<CalendarOutlined />}
                title="Nothing planned yet"
                text="Plan rent, salary or a subscription once; Settlr reminds you on the wallet when it is due."
                action={
                  <button
                    className="button primary"
                    onClick={() => setEditingPlan("new")}
                  >
                    <PlusOutlined /> Plan a payment
                  </button>
                }
              />
            </Panel>
          ) : (
            <div className="plan-sections">
              <Panel className="planned-panel">
                <PanelTitle
                  title="Recurring"
                  meta={
                    recurring.length
                      ? `${recurring.filter((p) => p.active).length} active`
                      : "Nothing repeating yet"
                  }
                />
                {recurring.length ? (
                  list(recurring.map(toRow), "Recurring")
                ) : (
                  <p className="muted-copy planned-empty">
                    Repeating payments show here.
                  </p>
                )}
              </Panel>
              <Panel className="planned-panel">
                <PanelTitle
                  title="One-time"
                  meta={
                    oneTimeRows.length
                      ? `${oneTimeRows.filter((r) => !r.muted).length} waiting`
                      : "Nothing one-off planned"
                  }
                />
                {oneTimeRows.length ? (
                  list(oneTimeRows, "One-time")
                ) : (
                  <p className="muted-copy planned-empty">
                    A flight or a yearly fee you will pay once shows here.
                  </p>
                )}
              </Panel>
            </div>
          )}
          {editingPlan && (
            <PlanFormModal
              planId={editingPlan === "new" ? undefined : editingPlan}
              accounts={refs.accounts}
              categories={refs.categories}
              tags={refs.tags}
              baseCurrency={baseCurrency}
              onClose={() => setEditingPlan(null)}
              onSaved={(message) => {
                setEditingPlan(null);
                refresh(message);
              }}
            />
          )}
          {editingItem && (
            <TransactionEditor
              transactionId={editingItem}
              accounts={refs.accounts}
              categories={refs.categories}
              tags={refs.tags}
              baseCurrency={baseCurrency}
              onClose={() => setEditingItem(null)}
              onSaved={(message) => {
                setEditingItem(null);
                refresh(message);
              }}
            />
          )}
          {paying && (
            <PayDialog
              item={paying}
              accounts={refs.accounts}
              onClose={() => setPaying(undefined)}
              onPaid={(result) => {
                const name = paying.title || "planned payment";
                const verb = paying.type === "INCOME" ? "Received" : "Paid";
                setPaying(undefined);
                refresh(
                  `${verb} “${name}”.${result.next?.due_at ? ` Next due ${shortDate(result.next.due_at)}.` : ""}`,
                );
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
