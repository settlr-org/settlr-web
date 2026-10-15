"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusOutlined } from "@ant-design/icons";
import { Panel, PanelTitle } from "../UI";
import { apiFetch } from "../../lib/api";
import { formatMoney, Period } from "../../lib/wallet";
import {
  BudgetList,
  budgetProgress,
  buildBudgetQuery,
} from "../../lib/planning";

/** Compact budget bars for the wallet side column (first four budgets). */
export function BudgetsMini({
  period,
  reloadKey,
}: {
  period: Period;
  reloadKey: number;
}) {
  const [list, setList] = useState<BudgetList>();
  useEffect(() => {
    let cancelled = false;
    apiFetch<BudgetList>(`/api/v1/budgets${buildBudgetQuery(period)}`)
      .then((l) => !cancelled && setList(l))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [period, reloadKey]);

  if (!list) return null;
  const shown = list.data.slice(0, 4);
  return (
    <Panel className="budgets-mini">
      <PanelTitle
        title="Budgets"
        meta={
          list.data.length
            ? `${formatMoney(Math.abs(list.total_remaining), list.currency)} ${list.total_remaining < 0 ? "over" : "left"} this period`
            : undefined
        }
        action={
          <Link className="text-button" href="/wallet/budgets">
            {list.data.length ? "All budgets" : "Set up"}
          </Link>
        }
      />
      {shown.length ? (
        <ul className="budget-mini-list">
          {shown.map((b) => {
            const progress = budgetProgress(b);
            return (
              <li key={b.id} className={`is-${progress.state}`}>
                <div className="budget-head">
                  <strong>{b.name}</strong>
                  <span className={progress.over ? "amount-out" : undefined}>
                    {formatMoney(b.spent, b.currency)} /{" "}
                    {formatMoney(b.amount, b.currency)}
                  </span>
                </div>
                <div
                  className="meter"
                  role="progressbar"
                  aria-label={`${b.name}: ${progress.percent}% spent`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(progress.percent, 100)}
                >
                  <i style={{ width: `${progress.width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted-copy">
          No budgets yet.{" "}
          <Link href="/wallet/budgets" className="inline-link">
            <PlusOutlined /> New budget
          </Link>
        </p>
      )}
    </Panel>
  );
}
