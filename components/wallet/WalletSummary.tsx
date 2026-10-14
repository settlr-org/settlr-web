"use client";
import Link from "next/link";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  formatMoney,
  missingRatesText,
  Overview,
  WalletSettings,
} from "../../lib/wallet";

/** Last day of a period whose `to` is exclusive, e.g. "31 Oct". */
const projectedBy = (to: string) => {
  const end = new Date(new Date(to).getTime() - 1);
  return end.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Total balance (base currency), income and spending for a period. */
export function WalletSummary({
  overview,
  settings,
  accountCount,
  onToggleHidden,
  showProjected = true,
}: {
  overview?: Overview;
  settings: WalletSettings;
  accountCount: number;
  onToggleHidden: () => void;
  showProjected?: boolean;
}) {
  const currency = overview?.currency || "NPR";
  const hidden = settings.hide_balance;
  const missing = overview?.missing_rates ?? [];
  return (
    <section className="wallet-summary" aria-label="Wallet summary">
      <article className="wallet-total">
        <div className="wallet-total-head">
          <span>
            Total balance · {accountCount}{" "}
            {accountCount === 1 ? "account" : "accounts"}
          </span>
          <button
            type="button"
            className="ghost-icon"
            aria-pressed={hidden}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            title={hidden ? "Show balance" : "Hide balance"}
            onClick={onToggleHidden}
          >
            {hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>
        </div>
        <strong
          className={
            !hidden && (overview?.balance ?? 0) < 0 ? "is-negative" : ""
          }
        >
          {overview ? formatMoney(overview.balance, currency, { hidden }) : "…"}
        </strong>
        {showProjected &&
          overview?.projected_balance != null &&
          overview.projected_balance !== overview.balance && (
            <p className="wallet-sub">
              Projected{" "}
              {formatMoney(overview.projected_balance, currency, { hidden })} by{" "}
              {projectedBy(overview.to)} · after planned payments
            </p>
          )}
        {missing.length > 0 && (
          <p className="wallet-missing">
            <WarningOutlined aria-hidden="true" /> Some amounts are left out: no
            rate for {missingRatesText(missing)}.{" "}
            <Link href="/settings#rates">Add a rate</Link>
          </p>
        )}
      </article>
      <article className="wallet-stat">
        <span>Income</span>
        <strong className="amount-in">
          {overview
            ? formatMoney(overview.income, currency, {
                sign: "+",
                hidden: settings.hide_income,
              })
            : "…"}
        </strong>
      </article>
      <article className="wallet-stat">
        <span>Spent · incl. group shares</span>
        <strong className="amount-out">
          {overview
            ? formatMoney(overview.expense, currency, { sign: "-" })
            : "…"}
        </strong>
      </article>
    </section>
  );
}
