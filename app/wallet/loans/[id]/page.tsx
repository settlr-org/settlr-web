"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../../components/AppShell";
import {
  Empty,
  ErrorState,
  LoadError,
  Loading,
  Panel,
  PanelTitle,
  useConfirmation,
} from "../../../../components/UI";
import { apiFetch } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/wallet";
import {
  Loan,
  LoanRecord,
  LoanRecordType,
  loanProgress,
  loanWords,
} from "../../../../lib/planning";
import {
  accountMap,
  errorText,
  useWalletRefs,
  walletWrite,
} from "../../../../components/wallet/data";
import {
  LoanFormModal,
  LoanRecordModal,
} from "../../../../components/wallet/LoanDialogs";
import { ItemTile } from "../../../../components/wallet/icons";
import { type LoadFailure, toLoadFailure } from "../../../../lib/errors";

type Dialog =
  | { kind: "edit" }
  | { kind: "record"; record?: LoanRecord; type?: LoanRecordType };

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirmation();
  const { refs, error: refsError, reload } = useWalletRefs();
  const [loan, setLoan] = useState<Loan>();
  const [records, setRecords] = useState<LoanRecord[]>();
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Loan>(`/api/v1/loans/${id}`),
      apiFetch<{ data: LoanRecord[] }>(`/api/v1/loans/${id}/records`),
    ])
      .then(([l, r]) => {
        if (cancelled) return;
        setLoan(l);
        setRecords(
          [...r.data].sort(
            (a, b) =>
              new Date(b.occurred_at).getTime() -
              new Date(a.occurred_at).getTime(),
          ),
        );
      })
      .catch(
        (cause) =>
          !cancelled &&
          setLoadFailure(toLoadFailure(cause, "Could not load this loan.")),
      );
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const refresh = useCallback(
    (message?: string) => {
      if (message) setNotice(message);
      setError("");
      setLoadFailure(null);
      setReloadKey((k) => k + 1);
      void reload();
    },
    [reload],
  );

  const removeLoan = async () => {
    if (!loan) return;
    const ok = await confirm({
      title: `Delete “${loan.name}”?`,
      description:
        "The loan, its records and their account bookings are removed. Account balances update at once.",
      confirmLabel: "Delete loan",
      danger: true,
    });
    if (!ok) return;
    try {
      await walletWrite(`/api/v1/loans/${loan.id}`, "DELETE");
      router.replace("/wallet/loans");
    } catch (cause) {
      setError(errorText(cause, "Could not delete the loan."));
    }
  };

  const words = loanWords(loan?.type ?? "LEND");
  const progress = loan ? loanProgress(loan) : undefined;
  const accountsById = accountMap(refs?.accounts ?? []);
  const accountName = (accountId: string | null) =>
    accountId
      ? (accountsById[accountId]?.name ?? "Deleted account")
      : "No account";

  return (
    <AppShell
      title={loan?.name || "Loan"}
      eyebrow={loan ? `WALLET · ${words.kind.toUpperCase()}` : "WALLET · LOAN"}
      description={
        loan
          ? `${words.kind} ${formatMoney(loan.amount, loan.currency)} on ${longDate(loan.occurred_at)}${loan.note ? ` · ${loan.note}` : ""}`
          : "A loan and its repayments."
      }
      actions={
        <button
          className="button primary"
          disabled={!loan || !refs}
          onClick={() => setDialog({ kind: "record", type: "DECREASE" })}
        >
          <PlusOutlined /> Add record
        </button>
      }
    >
      <div className="detail-toolbar">
        <Link href="/wallet/loans" className="back-link">
          <ArrowLeftOutlined /> Loans
        </Link>
      </div>
      {loadFailure && !loan ? (
        <LoadError
          failure={loadFailure}
          retry={() => refresh()}
          backHref="/wallet/loans"
          backLabel="Back to loans"
        />
      ) : !loan || !records || !refs || !progress ? (
        refsError ? (
          <ErrorState message={refsError} retry={() => void reload()} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          {error && <ErrorState message={error} />}
          {notice && (
            <div className="success-banner" role="status">
              {notice}
            </div>
          )}
          <div className="wallet-toolbar">
            <span className="category-chip">
              <ItemTile icon={loan.icon} color={loan.color} size="sm" />
              <span
                className={`loan-pill loan-pill-${loan.type.toLowerCase()}`}
              >
                {loan.paid_off ? "Paid off" : words.kind}
              </span>
            </span>
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => setDialog({ kind: "record", type: "INCREASE" })}
              >
                <PlusOutlined /> {words.increase}
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
                onClick={() => void removeLoan()}
              >
                <DeleteOutlined /> Delete
              </button>
            </div>
          </div>
          <section className="wallet-summary" aria-label="Loan summary">
            <article className="wallet-total">
              <div className="wallet-total-head">
                <span>{loan.paid_off ? "Paid off" : words.remaining}</span>
              </div>
              <strong>{formatMoney(loan.remaining, loan.currency)}</strong>
              <span
                className="meter meter-band"
                role="progressbar"
                aria-label={`${progress.percent}% ${words.paid}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.width}
              >
                <i style={{ width: `${progress.width}%` }} />
              </span>
              <p className="wallet-sub">
                {progress.percent}% {words.paid}
              </p>
            </article>
            <article className="wallet-stat">
              <span>Total {words.kind.toLowerCase()}</span>
              <strong>{formatMoney(loan.total, loan.currency)}</strong>
              <small>Initial amount plus increases</small>
            </article>
            <article className="wallet-stat">
              <span>{loan.type === "LEND" ? "Paid back" : "Repaid"}</span>
              <strong className="amount-in">
                {formatMoney(loan.paid, loan.currency)}
              </strong>
              <small>
                {loan.records_count}{" "}
                {loan.records_count === 1 ? "record" : "records"}
              </small>
            </article>
          </section>
          <Panel className="history-panel">
            <PanelTitle
              title="Records"
              meta="Repayments and changes, newest first"
              action={
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setDialog({ kind: "record", type: "DECREASE" })
                  }
                >
                  <PlusOutlined /> {words.decrease}
                </button>
              }
            />
            <ul className="record-list">
              {records.map((r) => {
                const decrease = r.type === "DECREASE";
                // Cash direction from the user's side: a repayment of money
                // they lent comes in; borrowing more comes in too.
                const moneyIn = (loan.type === "LEND") === decrease;
                return (
                  <li key={r.id} className="record-row">
                    <span className="planned-main">
                      <button
                        type="button"
                        className="ledger-open"
                        aria-label={`Edit record: ${decrease ? words.decrease : words.increase}, ${longDate(r.occurred_at)}`}
                        onClick={() => setDialog({ kind: "record", record: r })}
                      >
                        {decrease ? words.decrease : words.increase}
                      </button>
                      <small>
                        {longDate(r.occurred_at)} · {accountName(r.account_id)}
                        {r.note ? ` · ${r.note}` : ""}
                      </small>
                    </span>
                    <span
                      className={`planned-amount ${moneyIn ? "amount-in" : "amount-out"}`}
                    >
                      {formatMoney(r.amount, loan.currency, {
                        sign: moneyIn ? "+" : "-",
                      })}
                    </span>
                  </li>
                );
              })}
              <li className="record-row is-initial">
                <span className="planned-main">
                  <strong>Initial amount</strong>
                  <small>
                    {longDate(loan.occurred_at)} ·{" "}
                    {accountName(loan.account_id)}
                  </small>
                </span>
                <span className="planned-amount">
                  {formatMoney(loan.amount, loan.currency)}
                </span>
              </li>
            </ul>
            {!records.length && (
              <Empty
                title="No records yet"
                text={`Add a record each time money is ${loan.type === "LEND" ? "paid back to you" : "repaid"}.`}
              />
            )}
          </Panel>
          {dialog?.kind === "edit" && (
            <LoanFormModal
              loan={loan}
              accounts={refs.accounts}
              count={0}
              baseCurrency={loan.currency}
              onClose={() => setDialog(null)}
              onSaved={() => {
                setDialog(null);
                refresh("Loan saved.");
              }}
            />
          )}
          {dialog?.kind === "record" && (
            <LoanRecordModal
              loan={loan}
              record={dialog.record}
              initialType={dialog.type}
              accounts={refs.accounts}
              onClose={() => setDialog(null)}
              onSaved={(message) => {
                setDialog(null);
                refresh(message);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
