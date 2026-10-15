"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  FundOutlined,
  PlusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import {
  Empty,
  ErrorState,
  Loading,
  Panel,
  PanelTitle,
} from "../../../components/UI";
import { apiFetch } from "../../../lib/api";
import {
  formatMoney,
  missingRatesText,
  moveItem,
  Period,
  periodContaining,
} from "../../../lib/wallet";
import {
  Budget,
  BudgetList,
  budgetProgress,
  buildBudgetQuery,
  daysLeft,
} from "../../../lib/planning";
import {
  accountMap,
  categoryMap,
  errorText,
  useWalletRefs,
  walletWrite,
} from "../../../components/wallet/data";
import { PeriodSelector } from "../../../components/wallet/PeriodSelector";
import { PlanTabs } from "../../../components/wallet/PlanTabs";
import { BudgetFormModal } from "../../../components/wallet/BudgetForm";

export default function BudgetsPage() {
  const { refs, error: refsError, reload } = useWalletRefs();
  const [period, setPeriod] = useState<Period>();
  const [list, setList] = useState<BudgetList>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const [reordering, setReordering] = useState<Budget[] | null>(null);
  const startDay = refs?.settings.month_start_day ?? 1;

  useEffect(() => {
    if (refs && !period) setPeriod(periodContaining(new Date(), startDay));
  }, [refs, period, startDay]);

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    apiFetch<BudgetList>(`/api/v1/budgets${buildBudgetQuery(period)}`)
      .then((l) => !cancelled && setList(l))
      .catch(
        (cause) =>
          !cancelled && setError(errorText(cause, "Could not load budgets.")),
      );
    return () => {
      cancelled = true;
    };
  }, [period, reloadKey]);

  const refresh = useCallback((message?: string) => {
    if (message) setNotice(message);
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  const saveOrder = async () => {
    if (!reordering) return;
    try {
      await walletWrite("/api/v1/budgets/reorder", "POST", {
        ids: reordering.map((b) => b.id),
      });
      setReordering(null);
      refresh("Budget order saved.");
    } catch (cause) {
      setError(errorText(cause, "Could not save the order."));
    }
  };

  const categoriesById = useMemo(
    () => categoryMap(refs?.categories ?? []),
    [refs],
  );
  const accountsById = useMemo(() => accountMap(refs?.accounts ?? []), [refs]);
  const now = new Date();
  const currency = list?.currency || "NPR";
  const budgets = reordering ?? list?.data ?? [];
  const totalOver = (list?.total_remaining ?? 0) < 0;
  const remainingDays =
    period && period.from <= now ? daysLeft(period.to, now) : null;

  return (
    <AppShell
      title="Budgets"
      eyebrow="WALLET · PLAN"
      description="Spending limits per period — your share of group expenses counts."
      actions={
        <button
          className="button primary"
          disabled={!refs}
          onClick={() => setEditing("new")}
        >
          <PlusOutlined /> New budget
        </button>
      }
    >
      <PlanTabs />
      {!refs || !period ? (
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
          <div className="wallet-toolbar">
            <PeriodSelector
              period={period}
              startDay={startDay}
              onChange={setPeriod}
            />
          </div>
          <section className="wallet-summary" aria-label="Budget totals">
            <article className="wallet-total">
              <div className="wallet-total-head">
                <span>
                  {totalOver ? "Over budget" : "Left to spend"}
                  {remainingDays !== null && remainingDays > 0
                    ? ` · ${remainingDays} ${remainingDays === 1 ? "day" : "days"} to go`
                    : ""}
                </span>
              </div>
              <strong>
                {list
                  ? formatMoney(Math.abs(list.total_remaining), currency)
                  : "…"}
              </strong>
              {(list?.missing_rates ?? []).length > 0 && (
                <p className="wallet-missing">
                  <WarningOutlined aria-hidden="true" /> Some spending is left
                  out: no rate for {missingRatesText(list?.missing_rates)}.{" "}
                  <Link href="/settings#rates">Add a rate</Link>
                </p>
              )}
            </article>
            <article className="wallet-stat">
              <span>Budgeted</span>
              <strong>
                {list ? formatMoney(list.total_amount, currency) : "…"}
              </strong>
            </article>
            <article className="wallet-stat">
              <span>Spent · incl. group shares</span>
              <strong className={totalOver ? "amount-out" : undefined}>
                {list ? formatMoney(list.total_spent, currency) : "…"}
              </strong>
            </article>
          </section>
          <Panel className="budgets-panel">
            <PanelTitle
              title="Your budgets"
              meta="Expenses in the period. Transfers, loans and balance adjustments never count."
              action={
                !reordering &&
                (list?.data.length ?? 0) > 1 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setReordering(list!.data)}
                  >
                    Reorder
                  </button>
                )
              }
            />
            {!list ? (
              <p className="muted-copy history-status">Loading budgets…</p>
            ) : budgets.length ? (
              <ul className="budget-list">
                {budgets.map((b, index) => {
                  const progress = budgetProgress(b);
                  const cats = b.category_ids
                    .map((id) => categoriesById[id])
                    .filter(Boolean);
                  const accts = b.account_ids
                    .map((id) => accountsById[id])
                    .filter(Boolean);
                  return (
                    <li
                      key={b.id}
                      className={`budget-card is-${progress.state}`}
                    >
                      <div className="budget-head">
                        <h3>{b.name}</h3>
                        <span className="budget-figures">
                          <span className={progress.over ? "amount-out" : ""}>
                            {formatMoney(b.spent, b.currency)}
                          </span>{" "}
                          / {formatMoney(b.amount, b.currency)}
                        </span>
                      </div>
                      <div
                        className="meter"
                        role="progressbar"
                        aria-label={`${b.name}: ${progress.percent}% of the budget spent`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(progress.percent, 100)}
                        aria-valuetext={`${progress.percent}% spent`}
                      >
                        <i style={{ width: `${progress.width}%` }} />
                      </div>
                      <p className="budget-note">
                        {progress.over
                          ? `${formatMoney(progress.left, b.currency)} over`
                          : `${formatMoney(progress.left, b.currency)} left`}
                        {" · "}
                        {progress.percent}% used
                        {(b.missing_rates ?? []).length > 0 && (
                          <span className="missing-icon">
                            {" · "}
                            <WarningOutlined aria-hidden="true" /> no rate for{" "}
                            {missingRatesText(b.missing_rates)}
                          </span>
                        )}
                      </p>
                      <div className="budget-foot">
                        <div className="budget-chips">
                          {cats.length ? (
                            cats.map((c) => (
                              <span key={c.id} className="tag-badge">
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="tag-badge">All categories</span>
                          )}
                          {accts.length ? (
                            accts.map((a) => (
                              <span key={a.id} className="group-badge">
                                {a.name}
                              </span>
                            ))
                          ) : (
                            <span className="group-badge">All accounts</span>
                          )}
                        </div>
                        {reordering ? (
                          <span className="reorder-buttons">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Move ${b.name} up`}
                              disabled={index === 0}
                              onClick={() =>
                                setReordering(moveItem(reordering, index, -1))
                              }
                            >
                              <ArrowUpOutlined />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Move ${b.name} down`}
                              disabled={index === reordering.length - 1}
                              onClick={() =>
                                setReordering(moveItem(reordering, index, 1))
                              }
                            >
                              <ArrowDownOutlined />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="button"
                            aria-label={`Edit ${b.name}`}
                            onClick={() => setEditing(b)}
                          >
                            <EditOutlined /> Edit
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty
                icon={<FundOutlined />}
                title="No budgets yet"
                text="Set a limit for food, travel or everything, and see how much is left this period."
                action={
                  <button
                    className="button primary"
                    onClick={() => setEditing("new")}
                  >
                    <PlusOutlined /> New budget
                  </button>
                }
              />
            )}
            {reordering && (
              <div className="button-row panel-footer">
                <button
                  type="button"
                  className="button"
                  onClick={() => setReordering(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => void saveOrder()}
                >
                  Save order
                </button>
              </div>
            )}
          </Panel>
          {editing && (
            <BudgetFormModal
              budget={editing === "new" ? undefined : editing}
              accounts={refs.accounts}
              categories={refs.categories}
              baseCurrency={currency}
              onClose={() => setEditing(null)}
              onSaved={(message) => {
                setEditing(null);
                refresh(message);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
