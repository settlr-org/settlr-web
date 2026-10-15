"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Modal, Panel, PanelTitle, useConfirmation } from "../UI";
import { apiFetch, ApiError } from "../../lib/api";
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
  buildSkipOverdueQuery,
  cadenceLabel,
  dueLabel,
  PayResult,
  PlannedItem,
  PlannedLists,
} from "../../lib/planning";
import { errorText, fetchRatesFor, walletWrite } from "./data";
import { DeferredActions, flushOnLeave, withoutHeld } from "../../lib/undo";
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
      setError(
        cause instanceof ApiError && cause.code === "RATES_UNAVAILABLE"
          ? `No ${item.currency}→${payCurrency} exchange rate — type the amount in ${payCurrency}, or add a rate in Settings.`
          : errorText(cause, "Could not record the payment."),
      );
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
 * Overdue and upcoming planned items with Pay / Skip. `scope` limits
 * "Skip all overdue" (POST /transactions/skip-overdue) to an account or category.
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
  scope,
  hideWhenEmpty = false,
  announce = false,
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
  /** Limits "Skip all overdue" to these accounts / categories (detail pages). */
  scope?: { accounts?: string[]; categories?: string[] };
  hideWhenEmpty?: boolean;
  /** Show the result of pay/skip inside the panel (pages without a notice banner). */
  announce?: boolean;
  title?: string;
  onChanged: (message: string) => void;
}) {
  const confirm = useConfirmation();
  const [lists, setLists] = useState<PlannedLists>({ upcoming, overdue });
  const [paying, setPaying] = useState<PlannedItem>();
  const [editing, setEditing] = useState<PlannedItem>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => setLists({ upcoming, overdue }), [upcoming, overdue]);
  const report = (message: string) => {
    if (announce && message) setStatus(message);
    onChanged(message);
  };

  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const settle = (id: string, next: PlannedItem | null, message: string) => {
    setLists((l) => applyPlannedResult(l, id, next, new Date(), periodEnd));
    report(message);
  };

  // Skipping has no server-side restore, so it is queued for a few seconds
  // with an Undo; leaving the page sends anything still queued.
  const deferred = useRef(new DeferredActions());
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const [undo, setUndo] = useState<{ id: string; message: string }>();
  const release = (id: string) =>
    setHeld((h) => {
      const next = new Set(h);
      next.delete(id);
      return next;
    });
  useEffect(() => {
    const queue = deferred.current;
    const stop = flushOnLeave(queue);
    return () => {
      stop();
      void queue.flushAll();
    };
  }, []);
  const listsRef = useRef(lists);
  listsRef.current = lists;
  // Ids already skipped on the server: React may not have re-rendered the
  // lists yet when Skip all counts what is left.
  const skippedRef = useRef(new Set<string>());

  const skip = (item: PlannedItem) => {
    const name = item.title || "planned payment";
    setError("");
    setHeld((h) => new Set(h).add(item.id));
    setUndo({ id: item.id, message: `Skipping “${name}” in 6s…` });
    // One key for every send of this skip, so a keepalive resend is a no-op.
    const idempotencyKey = crypto.randomUUID();
    deferred.current.schedule(item.id, async ({ keepalive }) => {
      setUndo((u) => (u?.id === item.id ? undefined : u));
      try {
        const result = await walletWrite<PayResult>(
          `/api/v1/transactions/${item.id}/skip`,
          "POST",
          undefined,
          { idempotencyKey, keepalive },
        );
        skippedRef.current.add(item.id);
        release(item.id);
        settle(
          item.id,
          result.next,
          `Skipped “${name}”.${result.next?.due_at ? ` Next due ${shortDate(result.next.due_at)}.` : ""}`,
        );
      } catch (cause) {
        release(item.id);
        setError(errorText(cause, "Could not skip it."));
      }
    });
  };
  const undoSkip = () => {
    if (!undo) return;
    deferred.current.undo(undo.id);
    release(undo.id);
    setUndo(undefined);
  };

  const overdueShown = withoutHeld(lists.overdue, held);
  const upcomingShown = withoutHeld(lists.upcoming, held);

  const skipAll = async () => {
    // Send queued single skips first so the count is right and they cannot
    // fire (and 404) after the bulk skip.
    if (deferred.current.size) {
      await deferred.current.flushAll();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const count = listsRef.current.overdue.filter(
      (i) => !skippedRef.current.has(i.id),
    ).length;
    if (!count) return;
    const ok = await confirm({
      title: `Skip ${count} overdue ${count === 1 ? "item" : "items"}?`,
      description: scope
        ? "Nothing is recorded. Repeating plans listed here move to their next date from today; one-off items are removed."
        : "Nothing is recorded. Every repeating plan moves to its next date from today; one-off items are removed.",
      confirmLabel: "Skip all overdue",
      danger: true,
    });
    if (!ok) return;
    setBusy("all");
    setError("");
    try {
      const { skipped } = await walletWrite<{ skipped: number }>(
        `/api/v1/transactions/skip-overdue${buildSkipOverdueQuery(scope ?? {})}`,
        "POST",
      );
      setLists((l) => ({ ...l, overdue: [] }));
      report(
        `Skipped ${skipped} overdue ${skipped === 1 ? "payment" : "payments"}.`,
      );
    } catch (cause) {
      setError(errorText(cause, "Could not skip the overdue payments."));
      report("");
    } finally {
      setBusy("");
    }
  };

  if (
    hideWhenEmpty &&
    !upcomingShown.length &&
    !overdueShown.length &&
    !status &&
    !undo &&
    !paying &&
    !editing
  )
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
          overdueShown.length || upcomingShown.length
            ? [
                overdueShown.length ? `${overdueShown.length} overdue` : "",
                upcomingShown.length
                  ? `${upcomingShown.length} coming up this period`
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
      {undo && (
        <p className="planned-status" role="status">
          {undo.message}{" "}
          <button type="button" className="text-button" onClick={undoSkip}>
            Undo
          </button>
        </p>
      )}
      {status && !undo && (
        <p className="planned-status" role="status">
          {status}
        </p>
      )}
      {overdueShown.length > 0 && (
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
            {overdueShown.map((i) => row(i, true))}
          </ul>
        </section>
      )}
      {upcomingShown.length > 0 && (
        <section aria-label="Upcoming" className="planned-section">
          {overdueShown.length > 0 && (
            <div className="planned-section-head">
              <h3>Upcoming</h3>
            </div>
          )}
          <ul className="planned-list">
            {upcomingShown.map((i) => row(i, false))}
          </ul>
        </section>
      )}
      {!overdueShown.length && !upcomingShown.length && (
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
            report(message);
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
            report(message);
          }}
        />
      )}
    </Panel>
  );
}
