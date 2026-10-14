"use client";
import { FormEvent, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Modal } from "../UI";
import { ApiError } from "../../lib/api";
import {
  Account,
  CURRENCIES,
  formatMoney,
  minorToInput,
  missingRatesText,
  evaluateExpression,
  toMinor,
  suggestColour,
} from "../../lib/wallet";
import { errorText, walletWrite } from "./data";
import { ColourPicker, IconPicker } from "./Pickers";

/** Create or edit an account. */
export function AccountFormModal({
  account,
  count,
  baseCurrency,
  onClose,
  onSaved,
}: {
  account?: Account;
  count: number;
  baseCurrency: string;
  onClose: () => void;
  onSaved: (account: Account) => void;
}) {
  const [color, setColor] = useState(account?.color || suggestColour(count));
  const [icon, setIcon] = useState(account?.icon || "wallet");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      setError("Give the account a name.");
      return;
    }
    const body: Record<string, unknown> = {
      name,
      currency: data.get("currency"),
      color,
      icon,
      include_in_balance: data.get("include_in_balance") === "on",
    };
    if (account) {
      body.archived = data.get("archived") === "on";
      if (data.get("is_default") === "on" && !account.is_default)
        body.is_default = true;
      if (body.currency === account.currency) delete body.currency;
    } else {
      const initial = String(data.get("initial_balance") || "").trim();
      if (initial) {
        const value = evaluateExpression(initial);
        if (value === null) {
          setError("Initial balance must be a number.");
          return;
        }
        body.initial_balance = toMinor(value);
      }
    }
    setBusy(true);
    setError("");
    try {
      const saved = await walletWrite<Account>(
        account ? `/api/v1/accounts/${account.id}` : "/api/v1/accounts",
        account ? "PATCH" : "POST",
        body,
      );
      onSaved(saved);
    } catch (cause) {
      setError(errorText(cause, "Could not save the account."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={account ? "Edit account" : "New account"}
      subtitle={
        account
          ? "Currency can only change while the account has no activity."
          : "Bank, cash, card, e-wallet — each account keeps one currency."
      }
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label>
          Name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={account?.name}
            placeholder="Bank, Cash, eSewa…"
            data-autofocus
          />
        </label>
        <div className="form-grid">
          <label>
            Currency
            <select
              name="currency"
              defaultValue={account?.currency || baseCurrency}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {!account && (
            <label>
              Initial balance
              <input
                name="initial_balance"
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
              />
            </label>
          )}
        </div>
        <ColourPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <label className="check-label">
          <input
            type="checkbox"
            name="include_in_balance"
            defaultChecked={account?.include_in_balance ?? true}
          />
          Count in total balance
        </label>
        {account && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                name="is_default"
                defaultChecked={account.is_default}
                disabled={account.is_default}
              />
              Default account
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="archived"
                defaultChecked={account.archived}
              />
              Archived (hidden from pickers)
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Saving…" : account ? "Save account" : "Create account"}
        </button>
      </form>
    </Modal>
  );
}

/** Set a target balance; the API posts the difference as an adjustment. */
export function AdjustBalanceModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(minorToInput(account.balance));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const incomplete = (account.missing_rates ?? []).length > 0;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = evaluateExpression(value);
    if (parsed === null) {
      setError("Enter the balance the account should have.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await walletWrite(`/api/v1/accounts/${account.id}/adjust`, "POST", {
        balance: toMinor(parsed),
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "RATES_UNAVAILABLE"
          ? `Part of this balance is in another currency with no exchange rate (${missingRatesText(account.missing_rates) || "unknown pair"}). Add a rate in Settings → Exchange rates, then try again.`
          : errorText(cause, "Could not set the balance."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Set balance"
      subtitle={`Current balance ${formatMoney(account.balance, account.currency)}. The difference is recorded as a balance adjustment.`}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        {incomplete && (
          <p className="warning-note">
            This balance is incomplete: no rate for{" "}
            {missingRatesText(account.missing_rates)}.{" "}
            <a href="/settings#rates">Add an exchange rate</a> first.
          </p>
        )}
        <label>
          New balance ({account.currency})
          <input
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Saving…" : "Set balance"}
        </button>
      </form>
    </Modal>
  );
}

/** Deleting an account needs its name typed back, since its transactions go with it. */
export function DeleteAccountModal({
  account,
  onClose,
  onDeleted,
}: {
  account: Account;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === account.name.trim();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) return;
    setBusy(true);
    try {
      await walletWrite(`/api/v1/accounts/${account.id}`, "DELETE");
      onDeleted();
    } catch (cause) {
      setError(errorText(cause, "Could not delete the account."));
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Delete account?"
      subtitle="Its transactions are deleted too, and group expenses or settlements paid from it are unlinked. This cannot be undone."
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label>
          Type “{account.name}” to confirm
          <input
            data-autofocus
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button full" onClick={onClose}>
            Keep account
          </button>
          <button className="button danger full" disabled={!matches || busy}>
            <DeleteOutlined /> Delete account
          </button>
        </div>
      </form>
    </Modal>
  );
}
