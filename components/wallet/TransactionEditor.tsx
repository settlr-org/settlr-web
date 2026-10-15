"use client";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CopyOutlined,
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Modal } from "../UI";
import { apiFetch } from "../../lib/api";
import {
  Account,
  colourCss,
  CURRENCIES,
  dateInput,
  dateTimeInput,
  evaluateExpression,
  FetchedRates,
  formatMoney,
  isExpression,
  minorToInput,
  Page,
  parseAmount,
  RateOverride,
  resolveRate,
  suggestColour,
  Tag,
  Transaction,
  transferToAmount,
  TxnType,
  WalletCategory,
} from "../../lib/wallet";
import {
  cadenceLabel,
  INTERVAL_UNITS,
  IntervalUnit,
  scheduleFields,
  utcDateInput,
} from "../../lib/planning";
import { errorText, fetchRatesFor, walletWrite } from "./data";

/** When the transaction happens: now/past, a planned due date, or repeating (creates a plan). */
type Schedule = "paid" | "planned" | "repeat";
const SCHEDULES: { value: Schedule; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "planned", label: "Planned (due date)" },
  { value: "repeat", label: "Repeat…" },
];

const TYPES: { value: TxnType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

/** Enter in an inline-create field runs the action instead of submitting the outer form. */
const onEnter =
  (action: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      action();
    }
  };

export function TransactionEditor({
  transactionId,
  initialType = "EXPENSE",
  initialAccountId,
  accounts: initialAccounts,
  categories: initialCategories,
  tags: initialTags,
  baseCurrency,
  onClose,
  onSaved,
}: {
  transactionId?: string;
  initialType?: TxnType;
  initialAccountId?: string;
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  baseCurrency?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(
    initialAccounts.filter((a) => !a.archived),
  );
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [loaded, setLoaded] = useState(!transactionId);
  const [original, setOriginal] = useState<Transaction>();
  const [type, setType] = useState<TxnType>(initialType);
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(
    initialAccountId ||
      initialAccounts.find((a) => a.is_default && !a.archived)?.id ||
      initialAccounts.find((a) => !a.archived)?.id ||
      "",
  );
  const [toAccountId, setToAccountId] = useState("");
  const [toAmountText, setToAmountText] = useState("");
  const [toAmountTouched, setToAmountTouched] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState(dateTimeInput(new Date()));
  const [schedule, setSchedule] = useState<Schedule>("paid");
  const [dueDate, setDueDate] = useState(dateInput(new Date()));
  const [repeatN, setRepeatN] = useState("1");
  const [repeatUnit, setRepeatUnit] = useState<IntervalUnit>("MONTH");
  const [currencyChoice, setCurrencyChoice] = useState(baseCurrency || "NPR");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creating, setCreating] = useState<"" | "account" | "category" | "tag">(
    "",
  );
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState(baseCurrency || "NPR");
  const [overrides, setOverrides] = useState<RateOverride[]>([]);
  const [fetched, setFetched] = useState<FetchedRates | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    apiFetch<Transaction>(`/api/v1/transactions/${transactionId}`)
      .then((t) => {
        setOriginal(t);
        setType(t.type);
        setAmountText(minorToInput(t.amount));
        if (t.account_id) setAccountId(t.account_id);
        if (!t.occurred_at) {
          // A planned (unpaid) item: edit its due date; it may have no account yet.
          setSchedule("planned");
          setAccountId(t.account_id || "");
          setCurrencyChoice(t.currency);
          if (t.due_at) setDueDate(utcDateInput(t.due_at));
        }
        setToAccountId(t.to_account_id || "");
        if (t.to_amount && t.type === "TRANSFER") {
          setToAmountText(minorToInput(t.to_amount));
          setToAmountTouched(true);
        }
        setCategoryId(t.category_id || "");
        setTitle(t.title || "");
        setDescription(t.description || "");
        if (t.occurred_at) setWhen(dateTimeInput(new Date(t.occurred_at)));
        setTagIds((t.tags ?? []).map((x) => x.id));
        // An archived account still has to be selectable for its own entries.
        setAccounts((list) => {
          const missing = initialAccounts.filter(
            (a) =>
              (a.id === t.account_id || a.id === t.to_account_id) &&
              !list.some((x) => x.id === a.id),
          );
          return [...list, ...missing];
        });
        setLoaded(true);
      })
      .catch((cause) => {
        setError(errorText(cause, "Could not load this transaction."));
        setLoaded(true);
      });
  }, [transactionId, initialAccounts]);

  const account = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const planning = schedule !== "paid";
  const loanManaged = original?.source === "LOAN";
  const currency =
    account?.currency ||
    (planning ? currencyChoice : baseCurrency || "NPR") ||
    "NPR";
  const crossCurrency =
    type === "TRANSFER" &&
    Boolean(toAccount) &&
    toAccount!.currency !== currency;

  const toCurrency = toAccount?.currency;
  useEffect(() => {
    if (!crossCurrency || !toCurrency) return;
    let cancelled = false;
    Promise.all([
      apiFetch<Page<RateOverride>>("/api/v1/me/rates").catch(() => ({
        data: [] as RateOverride[],
      })),
      fetchRatesFor(currency, toCurrency!),
    ]).then(([o, f]) => {
      if (cancelled) return;
      setOverrides(o.data);
      setFetched(f);
    });
    return () => {
      cancelled = true;
    };
  }, [crossCurrency, currency, toCurrency]);

  const amountValue = evaluateExpression(amountText);
  const amountMinor = parseAmount(amountText);
  const rate = crossCurrency
    ? resolveRate(currency, toAccount!.currency, overrides, fetched)
    : null;
  const computedToAmount = transferToAmount({
    amount: amountMinor,
    fromCurrency: currency,
    toCurrency: toAccount?.currency,
    rate: rate?.rate,
  });
  const shownToAmount = toAmountTouched
    ? toAmountText
    : computedToAmount
      ? minorToInput(computedToAmount)
      : "";

  const sortedCategories = useMemo(() => {
    const groups = new Map<string, WalletCategory[]>();
    for (const c of categories) {
      const key = c.is_system ? c.grouping || "Other" : "Your categories";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a === "Your categories" ? -1 : b === "Your categories" ? 1 : 0,
    );
  }, [categories]);

  const createInline = async () => {
    const name = newName.trim();
    if (!name) return;
    setError("");
    try {
      if (creating === "account") {
        const created = await walletWrite<Account>("/api/v1/accounts", "POST", {
          name,
          currency: newCurrency,
          color: suggestColour(accounts.length),
          icon: "wallet",
        });
        setAccounts((list) => [...list, created]);
        if (type === "TRANSFER" && accountId) setToAccountId(created.id);
        else setAccountId(created.id);
      } else if (creating === "category") {
        const created = await walletWrite<WalletCategory>(
          "/api/v1/categories",
          "POST",
          {
            name,
            icon: "tag",
            color: suggestColour(categories.length),
          },
        );
        setCategories((list) => [...list, { ...created, is_system: false }]);
        setCategoryId(created.id);
      } else if (creating === "tag") {
        const created = await walletWrite<Tag>("/api/v1/tags", "POST", {
          name,
          color: suggestColour(tags.length),
        });
        setTags((list) => [...list, created]);
        setTagIds((ids) => [...ids, created.id]);
      }
      setNewName("");
      setCreating("");
    } catch (cause) {
      setError(errorText(cause, `Could not create the ${creating}.`));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) {
      await createInline();
      return;
    }
    if (!amountMinor) {
      setError("Enter an amount greater than zero (e.g. 1200 or 300*4).");
      return;
    }
    if (!accountId && (!planning || type === "TRANSFER")) {
      setError("Choose an account, or create one.");
      return;
    }
    let toAmount: number | null = null;
    if (type === "TRANSFER") {
      if (!toAccountId || toAccountId === accountId) {
        setError("Choose a different account to transfer to.");
        return;
      }
      toAmount = transferToAmount({
        amount: amountMinor,
        fromCurrency: currency,
        toCurrency: toAccount?.currency,
        manual: toAmountTouched ? parseAmount(toAmountText) : null,
        rate: rate?.rate,
      });
      if (crossCurrency && !toAmount) {
        setError(
          `Enter the amount received in ${toAccount?.currency} — there is no exchange rate to work it out.`,
        );
        return;
      }
    }
    const common = {
      type,
      account_id: accountId || null,
      amount: amountMinor,
      currency,
      to_account_id: type === "TRANSFER" ? toAccountId : null,
      to_amount: type === "TRANSFER" ? toAmount : null,
      category_id: type === "TRANSFER" ? null : categoryId || null,
      title: title.trim(),
      description: description.trim(),
      tag_ids: tagIds,
    };
    if (schedule === "repeat") {
      const fields = scheduleFields({
        oneTime: false,
        n: repeatN,
        unit: repeatUnit,
        start: dueDate,
      });
      if (!fields.ok) {
        setError(fields.error);
        return;
      }
      setBusy(true);
      setError("");
      try {
        await walletWrite("/api/v1/planned", "POST", {
          ...common,
          ...fields.value,
        });
        onSaved(
          `Planned ${cadenceLabel(fields.value as never).toLowerCase()}: “${title.trim() || "payment"}”.`,
        );
      } catch (cause) {
        setError(errorText(cause, "Could not save the plan."));
      } finally {
        setBusy(false);
      }
      return;
    }
    let dates: Record<string, string>;
    if (schedule === "planned") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        setError("Choose a due date.");
        return;
      }
      dates = { due_at: dueDate };
    } else {
      const occurred = new Date(when);
      if (Number.isNaN(occurred.getTime())) {
        setError("Choose a valid date and time.");
        return;
      }
      dates = { occurred_at: occurred.toISOString() };
    }
    const body = { ...common, ...dates };
    setBusy(true);
    setError("");
    try {
      if (original)
        await walletWrite(`/api/v1/transactions/${original.id}`, "PATCH", body);
      else await walletWrite("/api/v1/transactions", "POST", body);
      onSaved(
        schedule === "planned"
          ? original
            ? "Planned payment updated."
            : "Planned payment added."
          : original
            ? "Transaction updated."
            : "Transaction added.",
      );
    } catch (cause) {
      setError(errorText(cause, "Could not save the transaction."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!original) return;
    setBusy(true);
    try {
      await walletWrite(`/api/v1/transactions/${original.id}`, "DELETE");
      onSaved("Transaction deleted.");
    } catch (cause) {
      setError(errorText(cause, "Could not delete the transaction."));
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (!original) return;
    setBusy(true);
    try {
      await walletWrite(
        `/api/v1/transactions/${original.id}/duplicate`,
        "POST",
      );
      onSaved("Transaction duplicated.");
    } catch (cause) {
      setError(errorText(cause, "Could not duplicate the transaction."));
      setBusy(false);
    }
  };

  const splitWithGroup = () => {
    const params = new URLSearchParams({ add: "shared" });
    if (amountMinor) params.set("amount", minorToInput(amountMinor));
    if (title.trim()) params.set("description", title.trim());
    if (accountId) params.set("account", accountId);
    params.set("currency", currency);
    params.set("date", when.slice(0, 10));
    if (categoryId) params.set("category", categoryId);
    if (description.trim()) params.set("notes", description.trim());
    onClose();
    router.push(`/overview?${params.toString()}`);
  };

  const inlineCreate = (kind: "account" | "category" | "tag", label: string) =>
    creating === kind ? (
      <div className="inline-create" role="group" aria-label={`New ${kind}`}>
        <input
          aria-label={`${label} name`}
          placeholder={`${label} name`}
          value={newName}
          maxLength={kind === "tag" ? 50 : 100}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={onEnter(() => void createInline())}
          autoFocus
        />
        {kind === "account" && (
          <select
            aria-label="Currency"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="button primary"
          onClick={() => void createInline()}
        >
          Add
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            setCreating("");
            setNewName("");
          }}
        >
          Cancel
        </button>
      </div>
    ) : null;

  const newButton = (kind: "account" | "category" | "tag", label: string) => (
    <button
      type="button"
      className="text-button field-action"
      aria-expanded={creating === kind}
      onClick={() => {
        setCreating(creating === kind ? "" : kind);
        setNewName("");
      }}
    >
      <PlusOutlined /> New {label}
    </button>
  );

  const heading = loanManaged
    ? "Loan transaction"
    : original
      ? `Edit ${planning ? "planned " : ""}${TYPES.find((t) => t.value === type)?.label.toLowerCase()}`
      : schedule === "repeat"
        ? "Plan a repeating payment"
        : type === "TRANSFER"
          ? "New transfer"
          : "Add transaction";

  if (loanManaged && original)
    return (
      <Modal
        title={heading}
        subtitle="Loan bookings follow their loan, so they can't be edited here."
        onClose={onClose}
      >
        <div className="stack-form">
          <p className="warning-note">
            <LockOutlined aria-hidden="true" />{" "}
            {original.title || "This booking"} ·{" "}
            {formatMoney(original.amount, original.currency)}. Change the
            amount, date or account on the loan record instead.
          </p>
          <div className="modal-actions">
            <button type="button" className="button full" onClick={onClose}>
              Close
            </button>
            {original.loan_id && (
              <Link
                className="button primary full"
                href={`/wallet/loans/${original.loan_id}`}
                onClick={onClose}
              >
                Open the loan
              </Link>
            )}
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal
      wide
      title={heading}
      subtitle={
        schedule === "repeat"
          ? "Creates a planned payment that repeats. Amounts accept sums like 1200*4."
          : "Amounts accept sums like 1200*4. Enter saves."
      }
      onClose={onClose}
    >
      {!loaded ? (
        <p className="muted-copy">Loading…</p>
      ) : (
        <form className="txn-editor" onSubmit={submit} noValidate>
          <div
            className="segmented txn-type"
            role="radiogroup"
            aria-label="Transaction type"
          >
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={type === t.value}
                className={type === t.value ? "active" : ""}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!original && (
            <div
              className="segmented txn-schedule"
              role="radiogroup"
              aria-label="When"
            >
              {SCHEDULES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={schedule === option.value}
                  className={schedule === option.value ? "active" : ""}
                  onClick={() => setSchedule(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <label className="amount-entry">
            <span>Amount ({currency})</span>
            <input
              data-autofocus
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-describedby="txn-amount-result"
              aria-invalid={Boolean(amountText) && amountValue === null}
            />
            <small id="txn-amount-result" aria-live="polite">
              {amountText && amountValue === null
                ? "Not a valid amount or sum"
                : isExpression(amountText) && amountMinor
                  ? `= ${formatMoney(amountMinor, currency)}`
                  : " "}
            </small>
          </label>

          <div className="form-grid">
            <div className="field">
              <div className="field-head">
                <label htmlFor="txn-account">
                  {type === "TRANSFER" ? "From account" : "Account"}
                </label>
                {newButton("account", "account")}
              </div>
              <select
                id="txn-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {planning && type !== "TRANSFER" ? (
                  <option value="">No account — choose when paying</option>
                ) : (
                  !accounts.length && <option value="">No accounts yet</option>
                )}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </div>
            {type === "TRANSFER" ? (
              <div className="field">
                <label htmlFor="txn-to-account">To account</label>
                <select
                  id="txn-to-account"
                  value={toAccountId}
                  onChange={(e) => {
                    setToAccountId(e.target.value);
                    setToAmountTouched(false);
                  }}
                >
                  <option value="">Choose an account</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.currency}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <div className="field-head">
                  <label htmlFor="txn-category">Category</label>
                  {newButton("category", "category")}
                </div>
                <select
                  id="txn-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">No category</option>
                  {sortedCategories.map(([group, list]) => (
                    <optgroup key={group} label={group}>
                      {list.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>
          {planning && !accountId && type !== "TRANSFER" && (
            <label>
              Currency
              <select
                value={currencyChoice}
                onChange={(e) => setCurrencyChoice(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {(creating === "account" || creating === "category") &&
            inlineCreate(
              creating,
              creating === "account" ? "Account" : "Category",
            )}

          {crossCurrency && (
            <div className="field">
              <div className="field-head">
                <label htmlFor="txn-to-amount">
                  Amount received ({toAccount!.currency})
                </label>
                {toAmountTouched && computedToAmount && (
                  <button
                    type="button"
                    className="text-button field-action"
                    onClick={() => setToAmountTouched(false)}
                  >
                    Use rate
                  </button>
                )}
              </div>
              <input
                id="txn-to-amount"
                inputMode="decimal"
                autoComplete="off"
                value={shownToAmount}
                placeholder="0.00"
                onChange={(e) => {
                  setToAmountTouched(true);
                  setToAmountText(e.target.value);
                }}
                aria-describedby="txn-rate-note"
              />
              <small id="txn-rate-note" className="muted-copy">
                {rate
                  ? `1 ${currency} = ${Number(rate.rate.toPrecision(6))} ${toAccount!.currency} (${rate.source === "override" ? "your rate" : "fetched rate"})`
                  : "No exchange rate available — type the amount received."}
              </small>
            </div>
          )}

          <div className="form-grid">
            <label>
              Title
              <input
                value={title}
                maxLength={200}
                placeholder={
                  type === "INCOME"
                    ? "Salary, refund…"
                    : type === "TRANSFER"
                      ? "Top up, savings…"
                      : "Groceries, rent…"
                }
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {planning ? (
              <label>
                {schedule === "repeat" ? "First payment" : "Due date"}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </label>
            ) : (
              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  required
                />
              </label>
            )}
          </div>
          {schedule === "repeat" && (
            <div className="interval-row">
              <label htmlFor="txn-every">Repeat every</label>
              <input
                id="txn-every"
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                value={repeatN}
                onChange={(e) => setRepeatN(e.target.value)}
              />
              <select
                aria-label="Unit"
                value={repeatUnit}
                onChange={(e) => setRepeatUnit(e.target.value as IntervalUnit)}
              >
                {INTERVAL_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <span className="muted-copy">
                {cadenceLabel({
                  one_time: false,
                  interval_n: Number(repeatN) || 1,
                  interval_unit: repeatUnit,
                })}
                {" · "}
                <Link href="/wallet/planned" className="inline-link">
                  Manage plans
                </Link>
              </span>
            </div>
          )}

          <fieldset className="tag-field">
            <div className="field-head">
              <legend>Tags</legend>
              {newButton("tag", "tag")}
            </div>
            <div className="chip-row">
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={on ? "chip active" : "chip"}
                    aria-pressed={on}
                    style={{ ["--chip" as string]: colourCss(tag.color) }}
                    onClick={() =>
                      setTagIds(
                        on
                          ? tagIds.filter((x) => x !== tag.id)
                          : [...tagIds, tag.id],
                      )
                    }
                  >
                    # {tag.name}
                  </button>
                );
              })}
              {!tags.length && creating !== "tag" && (
                <span className="muted-copy">No tags yet.</span>
              )}
            </div>
            {creating === "tag" && inlineCreate("tag", "Tag")}
          </fieldset>

          <label>
            Description
            <textarea
              value={description}
              maxLength={2000}
              placeholder="Optional note"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {confirmDelete ? (
            <div className="confirm-inline" role="group" aria-label="Confirm">
              <p>
                {planning
                  ? "Delete this planned payment? Nothing has been recorded for it yet."
                  : "Delete this transaction? Account balances update at once."}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button"
                  onClick={() => setConfirmDelete(false)}
                  autoFocus
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <DeleteOutlined /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="editor-actions">
              {original && (
                <>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <DeleteOutlined /> Delete
                  </button>
                  {!planning && (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => void duplicate()}
                    >
                      <CopyOutlined /> Duplicate
                    </button>
                  )}
                </>
              )}
              {!original && !planning && type === "EXPENSE" && (
                <button
                  type="button"
                  className="button"
                  onClick={splitWithGroup}
                >
                  <TeamOutlined /> Split with a group
                </button>
              )}
              <button className="button primary editor-save" disabled={busy}>
                {busy ? "Saving…" : original ? "Save changes" : "Save"}
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
