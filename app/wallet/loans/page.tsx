"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircleOutlined,
  PlusOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import { useSession } from "../../../components/SessionProvider";
import { Empty, ErrorState, Loading, Panel } from "../../../components/UI";
import { apiFetch } from "../../../lib/api";
import { formatMoney, missingRatesText } from "../../../lib/wallet";
import {
  buildLoanQuery,
  LoanList,
  loanProgress,
  LoanType,
  loanWords,
} from "../../../lib/planning";
import { errorText, useWalletRefs } from "../../../components/wallet/data";
import { PlanTabs } from "../../../components/wallet/PlanTabs";
import { LoanFormModal } from "../../../components/wallet/LoanDialogs";
import { ItemTile } from "../../../components/wallet/icons";

const TABS: { value: LoanType; label: string }[] = [
  { value: "LEND", label: "Lent" },
  { value: "BORROW", label: "Borrowed" },
];

export default function LoansPage() {
  const router = useRouter();
  const { user } = useSession();
  const { refs, error: refsError, reload } = useWalletRefs();
  const [tab, setTab] = useState<LoanType>("LEND");
  const [showPaidOff, setShowPaidOff] = useState(false);
  const [list, setList] = useState<LoanList>();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<LoanList>(
      `/api/v1/loans${buildLoanQuery({ includePaidOff: showPaidOff })}`,
    )
      .then((l) => !cancelled && setList(l))
      .catch(
        (cause) =>
          !cancelled && setError(errorText(cause, "Could not load loans.")),
      );
    return () => {
      cancelled = true;
    };
  }, [showPaidOff, reloadKey]);

  const refresh = useCallback(() => {
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  const currency = list?.currency || user?.default_currency || "NPR";
  const loans = (list?.data ?? []).filter((l) => l.type === tab);
  const words = loanWords(tab);
  const panelId = "loans-panel";

  return (
    <AppShell
      title="Loans"
      eyebrow="WALLET · PLAN"
      description="Money you lent or borrowed outside Settlr groups, with every repayment."
      actions={
        <button
          className="button primary"
          disabled={!refs}
          onClick={() => setCreating(true)}
        >
          <PlusOutlined /> New loan
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
          {error && <ErrorState message={error} retry={refresh} />}
          <section
            className="wallet-summary loan-summary"
            aria-label="Loan totals"
          >
            <article className="wallet-stat">
              <span>Owed to you</span>
              <strong className="amount-in">
                {list ? formatMoney(list.lend_remaining, currency) : "…"}
              </strong>
              <small>Still to collect on money you lent</small>
            </article>
            <article className="wallet-stat">
              <span>You owe</span>
              <strong className="amount-out">
                {list ? formatMoney(list.borrow_remaining, currency) : "…"}
              </strong>
              <small>Still to repay on money you borrowed</small>
            </article>
          </section>
          {(list?.missing_rates ?? []).length > 0 && (
            <p className="warning-note">
              <WarningOutlined aria-hidden="true" /> Totals leave out loans
              without a rate: {missingRatesText(list?.missing_rates)}.{" "}
              <Link href="/settings#rates">Add a rate</Link>
            </p>
          )}
          <div className="wallet-toolbar loan-toolbar">
            <div
              className="segmented loan-tabs"
              role="tablist"
              aria-label="Loans"
            >
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  id={`loan-tab-${t.value}`}
                  aria-selected={tab === t.value}
                  aria-controls={panelId}
                  tabIndex={tab === t.value ? 0 : -1}
                  className={tab === t.value ? "active" : ""}
                  onClick={() => setTab(t.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                    e.preventDefault();
                    const next = tab === "LEND" ? "BORROW" : "LEND";
                    setTab(next);
                    document.getElementById(`loan-tab-${next}`)?.focus();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="check-label loan-paid-toggle">
              <input
                type="checkbox"
                checked={showPaidOff}
                onChange={(e) => setShowPaidOff(e.target.checked)}
              />
              Show paid off
            </label>
          </div>
          <div id={panelId} role="tabpanel" aria-labelledby={`loan-tab-${tab}`}>
            {!list ? (
              <Loading />
            ) : loans.length ? (
              <ul className="loan-grid">
                {loans.map((loan) => {
                  const progress = loanProgress(loan);
                  return (
                    <li key={loan.id}>
                      <Link
                        href={`/wallet/loans/${loan.id}`}
                        className={
                          loan.paid_off ? "loan-card is-paid" : "loan-card"
                        }
                      >
                        <span className="loan-card-head">
                          <ItemTile icon={loan.icon} color={loan.color} />
                          <strong>{loan.name}</strong>
                          <span
                            className={`loan-pill loan-pill-${loan.type.toLowerCase()}`}
                          >
                            {loan.paid_off ? (
                              <>
                                <CheckCircleOutlined aria-hidden="true" /> Paid
                                off
                              </>
                            ) : (
                              words.kind
                            )}
                          </span>
                        </span>
                        <span
                          className="meter"
                          role="progressbar"
                          aria-label={`${loan.name}: ${progress.percent}% ${words.paid}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress.width}
                        >
                          <i style={{ width: `${progress.width}%` }} />
                        </span>
                        <span className="loan-card-foot">
                          <span>
                            {formatMoney(loan.paid, loan.currency)} {words.paid}
                          </span>
                          <span>
                            <strong>
                              {formatMoney(loan.remaining, loan.currency)}
                            </strong>{" "}
                            {words.left}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Panel>
                <Empty
                  icon={<SwapOutlined />}
                  title={tab === "LEND" ? "Nothing lent" : "Nothing borrowed"}
                  text={
                    showPaidOff
                      ? "No loans of this kind yet."
                      : "No open loans of this kind. Paid-off loans are hidden."
                  }
                  action={
                    <button
                      className="button primary"
                      onClick={() => setCreating(true)}
                    >
                      <PlusOutlined /> New loan
                    </button>
                  }
                />
              </Panel>
            )}
          </div>
          <p className="muted-copy loan-footnote">
            Loans are for people outside Settlr. Balances with friends stay on
            the <Link href="/friends">Friends</Link> tab. Loan bookings move
            account balances but never count as income or spending.
          </p>
          {creating && (
            <LoanFormModal
              initialType={tab}
              accounts={refs.accounts}
              count={list?.data.length ?? 0}
              baseCurrency={currency}
              onClose={() => setCreating(false)}
              onSaved={(loan) => {
                setCreating(false);
                router.push(`/wallet/loans/${loan.id}`);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
