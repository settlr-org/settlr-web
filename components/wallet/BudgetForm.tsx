"use client";
import { FormEvent, useMemo, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Modal } from "../UI";
import {
  Account,
  colourCss,
  CURRENCIES,
  minorToInput,
  parseAmount,
  WalletCategory,
} from "../../lib/wallet";
import { Budget } from "../../lib/planning";
import { errorText, walletWrite } from "./data";
import { AmountField } from "./AmountField";

/** Toggle chips for a multi-select where "none selected" means "all". */
function ChipSelect<T extends { id: string; name: string; color?: string }>({
  legend,
  allLabel,
  items,
  groups,
  value,
  onChange,
}: {
  legend: string;
  allLabel: string;
  items?: T[];
  groups?: [string, T[]][];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );
  const chip = (item: T) => {
    const on = value.includes(item.id);
    return (
      <button
        key={item.id}
        type="button"
        className={on ? "chip active" : "chip"}
        aria-pressed={on}
        style={{ ["--chip" as string]: colourCss(item.color) }}
        onClick={() => toggle(item.id)}
      >
        {item.name}
      </button>
    );
  };
  return (
    <fieldset className="tag-field">
      <div className="field-head">
        <legend>{legend}</legend>
        <span className="muted-copy">
          {value.length ? `${value.length} selected` : allLabel}
        </span>
      </div>
      <div className="chip-scroll">
        <div className="chip-row">
          <button
            type="button"
            className={value.length ? "chip" : "chip active"}
            aria-pressed={!value.length}
            onClick={() => onChange([])}
          >
            {allLabel}
          </button>
          {items?.map(chip)}
        </div>
        {groups?.map(([group, list]) => (
          <div key={group} className="chip-group">
            <span className="chip-group-label">{group}</span>
            <div className="chip-row">{list.map(chip)}</div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Create or edit a budget. Empty category/account lists mean "all". */
export function BudgetFormModal({
  budget,
  accounts,
  categories,
  baseCurrency,
  onClose,
  onSaved,
}: {
  budget?: Budget;
  accounts: Account[];
  categories: WalletCategory[];
  baseCurrency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(budget?.name ?? "");
  const [amountText, setAmountText] = useState(
    budget ? minorToInput(budget.amount) : "",
  );
  const [currency, setCurrency] = useState(budget?.currency ?? baseCurrency);
  const [categoryIds, setCategoryIds] = useState(budget?.category_ids ?? []);
  const [accountIds, setAccountIds] = useState(budget?.account_ids ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, WalletCategory[]>();
    for (const c of categories) {
      const key = c.is_system ? c.grouping || "Other" : "Your categories";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === "Your categories" ? -1 : b === "Your categories" ? 1 : 0,
    );
  }, [categories]);
  const accountItems = accounts.filter(
    (a) => !a.archived || accountIds.includes(a.id),
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!name.trim()) {
      setError("Give the budget a name.");
      return;
    }
    if (!amount) {
      setError("Enter a limit greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await walletWrite(
        budget ? `/api/v1/budgets/${budget.id}` : "/api/v1/budgets",
        budget ? "PATCH" : "POST",
        {
          name: name.trim(),
          amount,
          currency,
          category_ids: categoryIds,
          account_ids: accountIds,
        },
      );
      onSaved(
        budget ? `“${name.trim()}” saved.` : `Budget “${name.trim()}” created.`,
      );
    } catch (cause) {
      setError(errorText(cause, "Could not save the budget."));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!budget) return;
    setBusy(true);
    try {
      await walletWrite(`/api/v1/budgets/${budget.id}`, "DELETE");
      onSaved(`“${budget.name}” deleted.`);
    } catch (cause) {
      setError(errorText(cause, "Could not delete the budget."));
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={budget ? "Edit budget" : "New budget"}
      subtitle="A spending limit for each period. Your share of group expenses counts."
      onClose={onClose}
    >
      <form className="txn-editor" onSubmit={submit} noValidate>
        <label>
          Name
          <input
            value={name}
            maxLength={100}
            placeholder="Food & dining, Travel, Everything…"
            onChange={(e) => setName(e.target.value)}
            data-autofocus
          />
        </label>
        <div className="form-grid">
          <AmountField
            label="Limit per period"
            currency={currency}
            value={amountText}
            onChange={setAmountText}
          />
          <label>
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <ChipSelect
          legend="Categories"
          allLabel="All categories"
          groups={groups}
          value={categoryIds}
          onChange={setCategoryIds}
        />
        <ChipSelect
          legend="Accounts"
          allLabel="All accounts"
          items={accountItems}
          value={accountIds}
          onChange={setAccountIds}
        />
        <p className="muted-copy">
          With all accounts, every group share counts. With chosen accounts, a
          group share counts only when you paid it from one of them.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {confirmDelete ? (
          <div className="confirm-inline" role="group" aria-label="Confirm">
            <p>Delete this budget? Your transactions are not affected.</p>
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
                <DeleteOutlined /> Delete budget
              </button>
            </div>
          </div>
        ) : (
          <div className="editor-actions">
            {budget && (
              <button
                type="button"
                className="button danger"
                onClick={() => setConfirmDelete(true)}
              >
                <DeleteOutlined /> Delete
              </button>
            )}
            <button className="button primary editor-save" disabled={busy}>
              {busy ? "Saving…" : budget ? "Save changes" : "Create budget"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
