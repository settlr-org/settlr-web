"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../../components/AppShell";
import { ErrorState, Loading } from "../../../../components/UI";
import { apiFetch } from "../../../../lib/api";
import {
  Account,
  AccountSummary,
  buildLedgerQuery,
  formatMoney,
  missingRatesText,
  Period,
  periodContaining,
  TxnType,
} from "../../../../lib/wallet";
import { errorText, useWalletRefs } from "../../../../components/wallet/data";
import { PeriodSelector } from "../../../../components/wallet/PeriodSelector";
import { HistoryPanel } from "../../../../components/wallet/HistoryPanel";
import { TransactionEditor } from "../../../../components/wallet/TransactionEditor";
import {
  AccountFormModal,
  AdjustBalanceModal,
  DeleteAccountModal,
} from "../../../../components/wallet/AccountDialogs";
import { ItemTile } from "../../../../components/wallet/icons";

type Dialog =
  | { kind: "edit" }
  | { kind: "adjust" }
  | { kind: "delete" }
  | { kind: "txn"; id?: string; type?: TxnType };

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refs, reload, error: refsError } = useWalletRefs();
  const [account, setAccount] = useState<Account>();
  const [summary, setSummary] = useState<AccountSummary>();
  const [period, setPeriod] = useState<Period>();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const startDay = refs?.settings.month_start_day ?? 1;

  useEffect(() => {
    if (refs && !period) setPeriod(periodContaining(new Date(), startDay));
  }, [refs, period, startDay]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Account>(`/api/v1/accounts/${id}`)
      .then((a) => !cancelled && setAccount(a))
      .catch((cause) =>
        setError(errorText(cause, "Could not load this account.")),
      );
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    // Totals only: the entries list pages through /ledger below.
    apiFetch<AccountSummary>(
      `/api/v1/accounts/${id}/summary${buildLedgerQuery({ period, limit: 1 })}`,
    )
      .then((s) => !cancelled && setSummary(s))
      .catch((cause) =>
        setError(errorText(cause, "Could not load the summary.")),
      );
    return () => {
      cancelled = true;
    };
  }, [id, period, reloadKey]);

  const refresh = useCallback(
    async (message?: string) => {
      if (message) setNotice(message);
      await reload();
      setReloadKey((k) => k + 1);
    },
    [reload],
  );

  const hidden = refs?.settings.hide_balance ?? false;
  const currency = account?.currency || "NPR";
  const missing = [
    ...new Set([
      ...(account?.missing_rates ?? []),
      ...(summary?.missing_rates ?? []),
    ]),
  ];

  return (
    <AppShell
      title={account?.name || "Account"}
      eyebrow="WALLET ACCOUNT"
      description={
        account
          ? `${account.currency}${account.include_in_balance ? "" : " · not in total balance"}${account.archived ? " · archived" : ""}`
          : "Balance, flows and history for one account."
      }
      actions={
        <button
          className="button primary"
          aria-label="Add transaction"
          disabled={!account || !refs}
          onClick={() => setDialog({ kind: "txn", type: "EXPENSE" })}
        >
          <PlusOutlined /> Add transaction
        </button>
      }
    >
      {error && !account ? (
        <ErrorState message={error} retry={() => void refresh()} />
      ) : !account || !refs || !period ? (
        refsError ? (
          <ErrorState message={refsError} retry={() => void reload()} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <div className="detail-toolbar">
            <Link href="/wallet" className="back-link">
              <ArrowLeftOutlined /> Wallet
            </Link>
          </div>
          {error && <ErrorState message={error} />}
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
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => setDialog({ kind: "txn", type: "TRANSFER" })}
              >
                <SwapOutlined /> Transfer
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setDialog({ kind: "adjust" })}
              >
                Set balance
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setDialog({ kind: "edit" })}
              >
                <EditOutlined /> Edit
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => setDialog({ kind: "delete" })}
              >
                <DeleteOutlined /> Delete
              </button>
            </div>
          </div>
          <section className="wallet-summary" aria-label="Account summary">
            <article className="wallet-total">
              <div className="wallet-total-head">
                <span className="account-heading">
                  <ItemTile
                    icon={account.icon}
                    color={account.color}
                    size="sm"
                  />
                  Balance
                </span>
              </div>
              <strong
                className={!hidden && account.balance < 0 ? "is-negative" : ""}
              >
                {formatMoney(account.balance, currency, { hidden })}
              </strong>
              {account.balance_base != null &&
                account.base_currency !== currency && (
                  <p className="wallet-sub">
                    ≈{" "}
                    {formatMoney(account.balance_base, account.base_currency, {
                      hidden,
                    })}
                  </p>
                )}
              {missing.length > 0 && (
                <p className="wallet-missing">
                  <WarningOutlined aria-hidden="true" /> Incomplete: no rate for{" "}
                  {missingRatesText(missing)}.{" "}
                  <Link href="/settings#rates">Add a rate</Link>
                </p>
              )}
            </article>
            <article className="wallet-stat">
              <span>Income</span>
              <strong className="amount-in">
                {summary
                  ? formatMoney(summary.income, currency, {
                      sign: "+",
                      hidden: refs.settings.hide_income,
                    })
                  : "…"}
              </strong>
              {summary && (
                <small>
                  All money in {formatMoney(summary.inflow, currency)}
                </small>
              )}
            </article>
            <article className="wallet-stat">
              <span>Expense</span>
              <strong className="amount-out">
                {summary
                  ? formatMoney(summary.expense, currency, { sign: "-" })
                  : "…"}
              </strong>
              {summary && (
                <small>
                  All money out {formatMoney(summary.outflow, currency)}
                </small>
              )}
            </article>
          </section>
          <HistoryPanel
            title="Entries"
            accounts={refs.accounts}
            categories={refs.categories}
            tags={refs.tags}
            period={period}
            accountId={account.id}
            reloadKey={reloadKey}
            onOpen={(entry) => setDialog({ kind: "txn", id: entry.id })}
          />
          {dialog?.kind === "txn" && (
            <TransactionEditor
              key={dialog.id ?? "new"}
              transactionId={dialog.id}
              initialType={dialog.type}
              initialAccountId={account.id}
              accounts={refs.accounts}
              categories={refs.categories}
              tags={refs.tags}
              baseCurrency={account.base_currency}
              onClose={() => setDialog(null)}
              onSaved={(message) => {
                setDialog(null);
                void refresh(message);
              }}
            />
          )}
          {dialog?.kind === "edit" && (
            <AccountFormModal
              account={account}
              count={refs.accounts.length}
              baseCurrency={account.base_currency}
              onClose={() => setDialog(null)}
              onSaved={() => {
                setDialog(null);
                void refresh("Account saved.");
              }}
            />
          )}
          {dialog?.kind === "adjust" && (
            <AdjustBalanceModal
              account={account}
              onClose={() => setDialog(null)}
              onSaved={() => {
                setDialog(null);
                void refresh("Balance updated.");
              }}
            />
          )}
          {dialog?.kind === "delete" && (
            <DeleteAccountModal
              account={account}
              onClose={() => setDialog(null)}
              onDeleted={() => {
                setDialog(null);
                router.replace("/wallet");
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
