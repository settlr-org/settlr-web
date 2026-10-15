"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Modal } from "../UI";
import { apiFetch } from "../../lib/api";
import {
  Account,
  colourCss,
  CURRENCIES,
  dateInput,
  minorToInput,
  parseAmount,
  Tag,
  TxnType,
  WalletCategory,
} from "../../lib/wallet";
import {
  cadenceLabel,
  INTERVAL_UNITS,
  IntervalUnit,
  PlannedPayment,
  scheduleFields,
  utcDateInput,
} from "../../lib/planning";
import { errorText, walletWrite } from "./data";
import { AmountField } from "./AmountField";
import { Segmented } from "../RovingRadios";

const TYPES: { value: TxnType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

/** Categories grouped for an <optgroup> select: own first, then system groups. */
export function useGroupedCategories(categories: WalletCategory[]) {
  return useMemo(() => {
    const groups = new Map<string, WalletCategory[]>();
    for (const c of categories) {
      const key = c.is_system ? c.grouping || "Other" : "Your categories";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a === "Your categories" ? -1 : b === "Your categories" ? 1 : 0,
    );
  }, [categories]);
}

/** Create or edit a planned payment (recurring or one-time). */
export function PlanFormModal({
  planId,
  accounts,
  categories,
  tags,
  baseCurrency,
  onClose,
  onSaved,
}: {
  planId?: string;
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  baseCurrency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const active = accounts.filter((a) => !a.archived);
  const [plan, setPlan] = useState<PlannedPayment>();
  const [loaded, setLoaded] = useState(!planId);
  const [type, setType] = useState<TxnType>("EXPENSE");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(
    active.find((a) => a.is_default)?.id || active[0]?.id || "",
  );
  const [currencyChoice, setCurrencyChoice] = useState(baseCurrency);
  const [toAccountId, setToAccountId] = useState("");
  const [toAmountText, setToAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(dateInput(new Date()));
  const [oneTime, setOneTime] = useState(false);
  const [n, setN] = useState("1");
  const [unit, setUnit] = useState<IntervalUnit>("MONTH");
  const [isActive, setIsActive] = useState(true);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const grouped = useGroupedCategories(categories);

  useEffect(() => {
    if (!planId) return;
    apiFetch<PlannedPayment>(`/api/v1/planned/${planId}`)
      .then((p) => {
        setPlan(p);
        setType(p.type);
        setAmountText(minorToInput(p.amount));
        setAccountId(p.account_id || "");
        setCurrencyChoice(p.currency);
        setToAccountId(p.to_account_id || "");
        setToAmountText(p.to_amount ? minorToInput(p.to_amount) : "");
        setCategoryId(p.category_id || "");
        setTitle(p.title);
        setDescription(p.description);
        setStart(utcDateInput(p.start_at));
        setOneTime(p.one_time);
        setN(String(p.interval_n ?? 1));
        setUnit(p.interval_unit ?? "MONTH");
        setIsActive(p.active);
        setTagIds((p.tags ?? []).map((t) => t.id));
        setLoaded(true);
      })
      .catch((cause) => {
        setError(errorText(cause, "Could not load this plan."));
        setLoaded(true);
      });
  }, [planId]);

  // Accounts this plan may use: active ones plus whatever it already points at.
  const options = accounts.filter(
    (a) => !a.archived || a.id === accountId || a.id === toAccountId,
  );
  const account = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const currency = account?.currency || currencyChoice;
  const crossCurrency =
    type === "TRANSFER" &&
    Boolean(toAccount) &&
    toAccount!.currency !== currency;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!amount) {
      setError("Enter an amount greater than zero (e.g. 1200 or 300*4).");
      return;
    }
    if (type === "TRANSFER") {
      if (!accountId) {
        setError("Choose the account the transfer leaves from.");
        return;
      }
      if (!toAccountId || toAccountId === accountId) {
        setError("Choose a different account to transfer to.");
        return;
      }
    }
    let toAmount: number | null = null;
    if (crossCurrency) {
      toAmount = parseAmount(toAmountText);
      if (!toAmount) {
        setError(`Enter the amount received in ${toAccount!.currency}.`);
        return;
      }
    }
    const schedule = scheduleFields({ oneTime, n, unit, start });
    if (!schedule.ok) {
      setError(schedule.error);
      return;
    }
    const body = {
      type,
      amount,
      account_id: accountId || null,
      currency,
      to_account_id: type === "TRANSFER" ? toAccountId : null,
      to_amount: toAmount,
      category_id: type === "TRANSFER" ? null : categoryId || null,
      title: title.trim(),
      description: description.trim(),
      active: isActive,
      tag_ids: tagIds,
      ...schedule.value,
    };
    setBusy(true);
    setError("");
    try {
      if (plan) await walletWrite(`/api/v1/planned/${plan.id}`, "PATCH", body);
      else await walletWrite("/api/v1/planned", "POST", body);
      const name = title.trim() || "Plan";
      onSaved(plan ? `“${name}” updated.` : `“${name}” planned.`);
    } catch (cause) {
      setError(errorText(cause, "Could not save the plan."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await walletWrite(`/api/v1/planned/${plan.id}`, "DELETE");
      onSaved(`“${plan.title || "Plan"}” deleted.`);
    } catch (cause) {
      setError(errorText(cause, "Could not delete the plan."));
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={plan ? "Edit planned payment" : "Plan a payment"}
      subtitle={
        plan
          ? `${cadenceLabel(plan)} · paid occurrences stay in your history.`
          : "Settlr keeps the next payment waiting until you pay or skip it."
      }
      onClose={onClose}
    >
      {!loaded ? (
        <p className="muted-copy">Loading…</p>
      ) : (
        <form className="txn-editor" onSubmit={submit} noValidate>
          <Segmented
            className="txn-type"
            label="Type"
            options={TYPES}
            value={type}
            onChange={setType}
          />

          <AmountField
            large
            autoFocus
            label="Amount"
            currency={currency}
            value={amountText}
            onChange={setAmountText}
          />

          <div className="form-grid">
            <div className="field">
              <label htmlFor="plan-account">
                {type === "TRANSFER" ? "From account" : "Account"}
              </label>
              <select
                id="plan-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {type !== "TRANSFER" && (
                  <option value="">No account — choose when paying</option>
                )}
                {type === "TRANSFER" && !accountId && (
                  <option value="">Choose an account</option>
                )}
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </div>
            {!accountId && type !== "TRANSFER" ? (
              <div className="field">
                <label htmlFor="plan-currency">Currency</label>
                <select
                  id="plan-currency"
                  value={currencyChoice}
                  onChange={(e) => setCurrencyChoice(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : type === "TRANSFER" ? (
              <div className="field">
                <label htmlFor="plan-to-account">To account</label>
                <select
                  id="plan-to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                >
                  <option value="">Choose an account</option>
                  {options
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
                <label htmlFor="plan-category">Category</label>
                <select
                  id="plan-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">No category</option>
                  {grouped.map(([group, list]) => (
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
          {!accountId && type !== "TRANSFER" && (
            <div className="field">
              <label htmlFor="plan-category">Category</label>
              <select
                id="plan-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {grouped.map(([group, list]) => (
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
          {crossCurrency && (
            <AmountField
              label="Amount received"
              currency={toAccount!.currency}
              value={toAmountText}
              onChange={setToAmountText}
              hint="The accounts use different currencies."
            />
          )}

          <div className="form-grid">
            <label>
              Title
              <input
                value={title}
                maxLength={200}
                placeholder={
                  type === "INCOME" ? "Salary…" : "Rent, internet, insurance…"
                }
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {oneTime ? "Due date" : "First payment"}
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
          </div>

          <fieldset className="schedule-field">
            <legend>Repeat</legend>
            <Segmented
              label="Repeat"
              options={[
                { value: false, label: "Repeats" },
                { value: true, label: "One-time" },
              ]}
              value={oneTime}
              onChange={setOneTime}
            />
            {!oneTime && (
              <div className="interval-row">
                <label htmlFor="plan-every">Every</label>
                <input
                  id="plan-every"
                  type="number"
                  min={1}
                  max={1000}
                  inputMode="numeric"
                  value={n}
                  onChange={(e) => setN(e.target.value)}
                />
                <select
                  aria-label="Unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as IntervalUnit)}
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
                    interval_n: Number(n) || 1,
                    interval_unit: unit,
                  })}
                </span>
              </div>
            )}
          </fieldset>

          {tags.length > 0 && (
            <fieldset className="tag-field">
              <legend>Tags</legend>
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
              </div>
            </fieldset>
          )}

          <label>
            Description
            <textarea
              value={description}
              maxLength={2000}
              placeholder="Optional note"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="check-label">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active — keep the next payment waiting
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {confirmDelete ? (
            <div className="confirm-inline" role="group" aria-label="Confirm">
              <p>
                Delete this plan? Its waiting payment goes too; payments already
                made stay in your history.
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
                  <DeleteOutlined /> Delete plan
                </button>
              </div>
            </div>
          ) : (
            <div className="editor-actions">
              {plan && (
                <button
                  type="button"
                  className="button danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <DeleteOutlined /> Delete
                </button>
              )}
              <button className="button primary editor-save" disabled={busy}>
                {busy ? "Saving…" : plan ? "Save changes" : "Save plan"}
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
