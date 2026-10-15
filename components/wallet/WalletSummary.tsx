"use client";
import Link from "next/link";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  amountScale,
  formatMoney,
  missingRatesText,
  Overview,
  WalletSettings,
} from "../../lib/wallet";
import { formatDate } from "../../lib/dates";

/** Last day of a period whose `to` is exclusive, e.g. "31 Oct". */
const projectedBy = (to: string) => {
  const end = new Date(new Date(to).getTime() - 1);
  return formatDate(end);
};

/** A headline amount that steps down in size when the figure is very long. */
export function ScaledAmount({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <strong className={className} data-amount-scale={amountScale(text)}>
      {text}
    </strong>
  );
}

/** Total balance (base currency), income and spending for a period. */
export function WalletSummary({
  overview,
  settings,
  accountCount,
  onToggleHidden,
  showProjected = true,
  unavailable = false,
}: {
  overview?: Overview;
  settings: WalletSettings;
  accountCount: number;
  onToggleHidden: () => void;
  showProjected?: boolean;
  /** Totals failed to load: show a dash instead of a loading ellipsis. */
  unavailable?: boolean;
}) {
  const placeholder = unavailable ? "—" : "…";
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
        <ScaledAmount
          className={
            !hidden && (overview?.balance ?? 0) < 0 ? "is-negative" : ""
          }
          text={
            overview
              ? formatMoney(overview.balance, currency, { hidden })
              : placeholder
          }
        />
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
        <ScaledAmount
          className="amount-in"
          text={
            overview
              ? formatMoney(overview.income, currency, {
                  sign: "+",
                  hidden: settings.hide_income,
                })
              : placeholder
          }
        />
      </article>
      <article className="wallet-stat">
        <span>Spent · incl. group shares</span>
        <ScaledAmount
          className="amount-out"
          text={
            overview
              ? formatMoney(overview.expense, currency, { sign: "-" })
              : placeholder
          }
        />
      </article>
    </section>
  );
}
