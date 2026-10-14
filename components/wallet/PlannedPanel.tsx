"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Modal, Panel, PanelTitle, useConfirmation } from "../UI";
import { apiFetch } from "../../lib/api";
import {
  Account,
  convertMinor,
  dateTimeInput,
  formatMoney,
  minorToInput,
  Page,
  parseAmount,
  RateOverride,
  resolveRate,
  Tag,
  WalletCategory,
} from "../../lib/wallet";
import {
  applyPlannedResult,
  cadenceLabel,
  dueLabel,
  isOverdue,
  PayResult,
  PlannedItem,
  PlannedLists,
} from "../../lib/planning";
import { errorText, fetchRatesFor, walletWrite } from "./data";
import { AmountField } from "./AmountField";
import { PlanFormModal } from "./PlanForm";
import { TransactionEditor } from "./TransactionEditor";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

function signedAmount(item: PlannedItem) {
  const sign =
    item.type === "INCOME" ? "+" : item.type === "EXPENSE" ? "-" : undefined;
  return {
    text: formatMoney(item.amount, item.currency, { sign }),
    dir:
      item.type === "INCOME"
        ? "in"
        : item.type === "EXPENSE"
          ? "out"
          : "neutral",
  };
}

/** Confirm / adjust a planned payment before recording it. */
export function PayDialog({
  item,
  accounts,
  onClose,
  onPaid,
}: {
  item: PlannedItem;
  accounts: Account[];
  onClose: () => void;
  onPaid: (result: PayResult) => void;
}) {
  const usable = accounts.filter((a) => !a.archived);
  const [when, setWhen] = useState(dateTimeInput(new Date()));
  const [accountId, setAccountId] = useState(
    item.account_id ||
      usable.find((a) => a.currency === item.currency && a.is_default)?.id ||
      usable.find((a) => a.currency === item.currency)?.id ||
      "",
  );
  const account = accounts.find((a) => a.id === accountId);
  const payCurrency = account?.currency || item.currency;
  const converted = payCurrency !== item.currency;
  const [amountText, setAmountText] = useState(minorToInput(item.amount));
  const [rateNote, setRateNote] = useState("");
  const toAccount = accounts.find((a) => a.id === item.to_account_id);
  const crossTransfer =
    item.type === "TRANSFER" && toAccount && toAccount.currency !== payCurrency;
  const [toAmountText, setToAmountText] = useState(
    item.to_amount ? minorToInput(item.to_amount) : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Paying a planned item from an account in another currency: the amount must
  // be in that account's currency. Prefill a converted amount when a rate exists.
  useEffect(() => {
    if (!converted) {
      setAmountText(minorToInput(item.amount));
      setRateNote("");
      return;
    }
    let cancelled = false;
    setAmountText("");
    Promise.all([
      apiFetch<Page<RateOverride>>("/api/v1/me/rates").catch(() => ({
        data: [] as RateOverride[],
      })),
      fetchRatesFor(item.currency, payCurrency),
    ]).then(([o, f]) => {
      if (cancelled) return;
      const rate = resolveRate(item.currency, payCurrency, o.data, f);
      if (rate) {
        setAmountText(minorToInput(convertMinor(item.amount, rate.rate)));
        setRateNote(
          `Converted from ${formatMoney(item.amount, item.currency)} (${rate.source === "override" ? "your rate" : "fetched rate"}).`,
        );
      } else
        setRateNote(
          `No ${item.currency}→${payCurrency} rate — type the amount in ${payCurrency}.`,
        );
    });
    return () => {
      cancelled = true;
    };
  }, [converted, item.amount, item.currency, payCurrency]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!amount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!accountId) {
      setError("Choose the account this was paid from.");
      return;
    }
    const occurred = new Date(when);
    if (Number.isNaN(occurred.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }
    const body: Record<string, unknown> = {
      occurred_at: occurred.toISOString(),
    };
    if (amount !== item.amount || converted) body.amount = amount;
    if (accountId !== item.account_id) body.account_id = accountId;
    if (crossTransfer) {
      const toAmount = parseAmount(toAmountText);
      if (!toAmount) {
        setError(`Enter the amount received in ${toAccount!.currency}.`);
        return;
      }
      if (toAmount !== item.to_amount) body.to_amount = toAmount;
    }
    setBusy(true);
    setError("");
    try {
      const result = await walletWrite<PayResult>(
        `/api/v1/transactions/${item.id}/pay`,
        "POST",
        body,
      );
      onPaid(result);
    } catch (cause) {
      setError(errorText(cause, "Could not record the payment."));
      setBusy(false);
    }
  };

  const verb = item.type === "INCOME" ? "Receive" : "Pay";
  return (
    <Modal
      title={`${verb} “${item.title || "planned payment"}”`}
      subtitle={`${cadenceLabel(item.plan)} · due ${item.due_at ? shortDate(item.due_at) : "—"}. Adjust anything that went differently.`}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit} noValidate>
        <AmountField
          autoFocus
          label="Amount"
          currency={payCurrency}
          value={amountText}
          onChange={setAmountText}
          hint={rateNote || undefined}
        />
        {(!item.account_id || converted) && (
          <label>
            {item.type === "INCOME" ? "Received into" : "Paid from"}
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Choose an account</option>
              {usable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </label>
        )}
        {crossTransfer && (
          <AmountField
            label="Amount received"
            currency={toAccount!.currency}
            value={toAmountText}
            onChange={setToAmountText}
          />
        )}
        <label>
          Date and time
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button full" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary full" disabled={busy}>
            {busy
              ? "Saving…"
              : `Record ${item.type === "INCOME" ? "income" : "payment"}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Overdue and upcoming planned items with Pay / Skip. `scoped` lists (an
 * account's or a category's) skip their own overdue items one by one; the
 * wallet-wide list uses POST /transactions/skip-overdue.
 */
const NONE: PlannedItem[] = [];

export function PlannedPanel({
  upcoming = NONE,
  overdue = NONE,
  periodEnd,
  accounts,
  categories,
  tags,
  baseCurrency,
  scoped = false,
  hideWhenEmpty = false,
  title = "Upcoming & overdue",
  onChanged,
}: {
  /** Pass arrays with a stable identity (e.g. straight from fetched state). */
  upcoming?: PlannedItem[];
  overdue?: PlannedItem[];
  periodEnd?: Date;
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  baseCurrency: string;
  scoped?: boolean;
  hideWhenEmpty?: boolean;
  title?: string;
  onChanged: (message: string) => void;
}) {
  const confirm = useConfirmation();
  const [lists, setLists] = useState<PlannedLists>({ upcoming, overdue });
  const [paying, setPaying] = useState<PlannedItem>();
  const [editing, setEditing] = useState<PlannedItem>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setLists({ upcoming, overdue }), [upcoming, overdue]);

  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const settle = (id: string, next: PlannedItem | null, message: string) => {
    setLists((l) => applyPlannedResult(l, id, next, new Date(), periodEnd));
    onChanged(message);
  };

  const skip = async (item: PlannedItem) => {
    setBusy(item.id);
    setError("");
    try {
      const result = await walletWrite<PayResult>(
        `/api/v1/transactions/${item.id}/skip`,
        "POST",
      );
      settle(
        item.id,
        result.next,
        `Skipped “${item.title || "planned payment"}”.${result.next?.due_at ? ` Next due ${shortDate(result.next.due_at)}.` : ""}`,
      );
    } catch (cause) {
      setError(errorText(cause, "Could not skip it."));
    } finally {
      setBusy("");
    }
  };

  const skipAll = async () => {
    const count = lists.overdue.length;
    const ok = await confirm({
      title: `Skip ${count} overdue ${count === 1 ? "item" : "items"}?`,
      description: scoped
        ? "Nothing is recorded. Repeating plans listed here move to their next date from today; one-off items are removed."
        : "Nothing is recorded. Every repeating plan moves to its next date from today; one-off items are removed.",
      confirmLabel: "Skip all overdue",
      danger: true,
    });
    if (!ok) return;
    setBusy("all");
    setError("");
    try {
      let skipped = 0;
      if (scoped) {
        // Skip each listed item until its plan's next date is no longer overdue.
        for (const item of lists.overdue) {
          let id: string | undefined = item.id;
          for (let guard = 0; id && guard < 400; guard++) {
            const result: PayResult = await walletWrite<PayResult>(
              `/api/v1/transactions/${id}/skip`,
              "POST",
            );
            skipped++;
            id = isOverdue(result.next?.due_at, new Date())
              ? result.next!.id
              : undefined;
          }
        }
      } else {
        const result = await walletWrite<{ skipped: number }>(
          "/api/v1/transactions/skip-overdue",
          "POST",
        );
        skipped = result.skipped;
      }
      setLists((l) => ({ ...l, overdue: [] }));
      onChanged(
        `Skipped ${skipped} overdue ${skipped === 1 ? "payment" : "payments"}.`,
      );
    } catch (cause) {
      setError(errorText(cause, "Could not skip the overdue payments."));
      onChanged("");
    } finally {
      setBusy("");
    }
  };

  if (hideWhenEmpty && !lists.upcoming.length && !lists.overdue.length)
    return null;

  const row = (item: PlannedItem, late: boolean) => {
    const amount = signedAmount(item);
    const from = item.account_id
      ? accountsById[item.account_id]?.name
      : undefined;
    const to = item.to_account_id
      ? accountsById[item.to_account_id]?.name
      : undefined;
    const where =
      item.type === "TRANSFER"
        ? `${from ?? "—"} → ${to ?? "—"}`
        : (from ?? "No account yet");
    const category = item.category_id
      ? categoriesById[item.category_id]?.name
      : undefined;
    const name =
      item.title || item.plan?.title || category || "Planned payment";
    return (
      <li
        key={item.id}
        className={late ? "planned-row is-late" : "planned-row"}
      >
        <span className="planned-icon" aria-hidden="true">
          {late ? <ExclamationCircleOutlined /> : <CalendarOutlined />}
        </span>
        <span className="planned-main">
          <button
            type="button"
            className="ledger-open"
            onClick={() => setEditing(item)}
            aria-label={`Edit ${name}`}
          >
            {name}
          </button>
          <small>
            <span className={late ? "planned-late" : undefined}>
              {dueLabel(item.due_at, new Date())}
            </span>
            {" · "}
            {cadenceLabel(item.plan)} · {where}
          </small>
        </span>
        <span className={`planned-amount amount-${amount.dir}`}>
          {amount.text}
        </span>
        <span className="planned-actions">
          <button
            type="button"
            className="button pill-button"
            disabled={Boolean(busy)}
            onClick={() => setPaying(item)}
            aria-label={`${item.type === "INCOME" ? "Receive" : "Pay"} ${name}`}
          >
            {item.type === "INCOME" ? "Receive" : "Pay"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={Boolean(busy)}
            onClick={() => void skip(item)}
            aria-label={`Skip ${name}`}
          >
            {busy === item.id ? "Skipping…" : "Skip"}
          </button>
        </span>
      </li>
    );
  };

  return (
    <Panel className="planned-panel">
      <PanelTitle
        title={title}
        meta={
          lists.overdue.length || lists.upcoming.length
            ? [
                lists.overdue.length ? `${lists.overdue.length} overdue` : "",
                lists.upcoming.length
                  ? `${lists.upcoming.length} coming up this period`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : "Nothing waiting this period"
        }
        action={
          <Link className="text-button" href="/wallet/planned">
            Planned
          </Link>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {lists.overdue.length > 0 && (
        <section aria-label="Overdue" className="planned-section">
          <div className="planned-section-head">
            <h3>Overdue</h3>
            <button
              type="button"
              className="text-button danger-text"
              disabled={Boolean(busy)}
              onClick={() => void skipAll()}
            >
              {busy === "all" ? "Skipping…" : "Skip all overdue"}
            </button>
          </div>
          <ul className="planned-list">
            {lists.overdue.map((i) => row(i, true))}
          </ul>
        </section>
      )}
      {lists.upcoming.length > 0 && (
        <section aria-label="Upcoming" className="planned-section">
          {lists.overdue.length > 0 && (
            <div className="planned-section-head">
              <h3>Upcoming</h3>
            </div>
          )}
          <ul className="planned-list">
            {lists.upcoming.map((i) => row(i, false))}
          </ul>
        </section>
      )}
      {!lists.overdue.length && !lists.upcoming.length && (
        <p className="muted-copy planned-empty">
          Rent, salary, subscriptions — plan them once and pay with a tap.{" "}
          <Link href="/wallet/planned?new=1" className="inline-link">
            <PlusOutlined /> Plan a payment
          </Link>
        </p>
      )}
      {paying && (
        <PayDialog
          item={paying}
          accounts={accounts}
          onClose={() => setPaying(undefined)}
          onPaid={(result) => {
            const item = paying;
            setPaying(undefined);
            settle(
              item.id,
              result.next,
              `${item.type === "INCOME" ? "Received" : "Paid"} “${item.title || "planned payment"}”.${result.next?.due_at ? ` Next due ${shortDate(result.next.due_at)}.` : ""}`,
            );
          }}
        />
      )}
      {editing?.plan && (
        <PlanFormModal
          planId={editing.plan.id}
          accounts={accounts}
          categories={categories}
          tags={tags}
          baseCurrency={baseCurrency}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            onChanged(message);
          }}
        />
      )}
      {editing && !editing.plan && (
        <TransactionEditor
          transactionId={editing.id}
          accounts={accounts}
          categories={categories}
          tags={tags}
          baseCurrency={baseCurrency}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            onChanged(message);
          }}
        />
      )}
    </Panel>
  );
}
