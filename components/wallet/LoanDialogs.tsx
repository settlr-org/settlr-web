"use client";
import { FormEvent, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Modal } from "../UI";
import {
  Account,
  CURRENCIES,
  dateInput,
  minorToInput,
  parseAmount,
  suggestColour,
} from "../../lib/wallet";
import {
  Loan,
  LoanRecord,
  LoanRecordType,
  LoanType,
  loanWords,
} from "../../lib/planning";
import { errorText, walletWrite } from "./data";
import { AmountField } from "./AmountField";
import { ColourPicker, IconPicker } from "./Pickers";
import { Segmented } from "../RovingRadios";

/**
 * YYYY-MM-DD from a picker to an instant: today keeps the current time (so
 * the booking sorts after earlier entries today), other days use local noon.
 */
export function pickedDate(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const now = new Date();
  if (day === dateInput(now)) return now.toISOString();
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
  ).toISOString();
}

/** Account picker plus the booked amount when the account's currency differs. */
function AccountBooking({
  accounts,
  accountId,
  onAccount,
  currency,
  accountAmount,
  onAccountAmount,
  label,
  hint,
}: {
  accounts: Account[];
  accountId: string;
  onAccount: (id: string) => void;
  currency: string;
  accountAmount: string;
  onAccountAmount: (text: string) => void;
  label: string;
  hint: string;
}) {
  const options = accounts.filter((a) => !a.archived || a.id === accountId);
  const account = accounts.find((a) => a.id === accountId);
  return (
    <>
      <label>
        {label}
        <select value={accountId} onChange={(e) => onAccount(e.target.value)}>
          <option value="">Not tracked in an account</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
        <small className="field-hint">{hint}</small>
      </label>
      {account && account.currency !== currency && (
        <AmountField
          label="Booked in the account"
          currency={account.currency}
          value={accountAmount}
          onChange={onAccountAmount}
          hint={`Leave empty to convert from ${currency} at the current rate.`}
        />
      )}
    </>
  );
}

/** Create or edit a loan. */
export function LoanFormModal({
  loan,
  initialType = "LEND",
  accounts,
  count,
  baseCurrency,
  onClose,
  onSaved,
}: {
  loan?: Loan;
  initialType?: LoanType;
  accounts: Account[];
  count: number;
  baseCurrency: string;
  onClose: () => void;
  onSaved: (loan: Loan) => void;
}) {
  const [type, setType] = useState<LoanType>(loan?.type ?? initialType);
  const [name, setName] = useState(loan?.name ?? "");
  const [amountText, setAmountText] = useState(
    loan ? minorToInput(loan.amount) : "",
  );
  const [currency, setCurrency] = useState(loan?.currency ?? baseCurrency);
  const [accountId, setAccountId] = useState(loan?.account_id ?? "");
  const [accountAmount, setAccountAmount] = useState("");
  const [day, setDay] = useState(
    loan ? dateInput(new Date(loan.occurred_at)) : dateInput(new Date()),
  );
  const [color, setColor] = useState(loan?.color || suggestColour(count));
  const [icon, setIcon] = useState(loan?.icon || "cash");
  const [note, setNote] = useState(loan?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const words = loanWords(type);

  const chooseAccount = (id: string) => {
    setAccountId(id);
    setAccountAmount("");
    // A new loan follows its account's currency unless the user picked one.
    const account = accounts.find((a) => a.id === id);
    if (!loan && account && !amountText) setCurrency(account.currency);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!name.trim()) {
      setError("Give the loan a name, e.g. who it is with.");
      return;
    }
    if (!amount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const occurred = pickedDate(day);
    if (!occurred) {
      setError("Choose a date.");
      return;
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      type,
      amount,
      currency,
      color,
      icon,
      note: note.trim(),
      account_id: accountId || null,
    };
    // Keep the original timestamp unless the day was changed.
    if (!loan || day !== dateInput(new Date(loan.occurred_at)))
      body.occurred_at = occurred;
    if (accountAmount.trim()) {
      const booked = parseAmount(accountAmount);
      if (!booked) {
        setError("The booked amount must be greater than zero.");
        return;
      }
      body.account_amount = booked;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await walletWrite<Loan>(
        loan ? `/api/v1/loans/${loan.id}` : "/api/v1/loans",
        loan ? "PATCH" : "POST",
        body,
      );
      onSaved(saved);
    } catch (cause) {
      setError(errorText(cause, "Could not save the loan."));
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={loan ? "Edit loan" : "New loan"}
      subtitle="For money lent to or borrowed from anyone — money shared with friends is tracked under Friends."
      onClose={onClose}
    >
      <form className="txn-editor" onSubmit={submit} noValidate>
        <Segmented<LoanType>
          className="txn-type"
          label="Type"
          options={[
            { value: "LEND", label: "I lent" },
            { value: "BORROW", label: "I borrowed" },
          ]}
          value={type}
          onChange={setType}
        />
        <label>
          Name
          <input
            value={name}
            maxLength={100}
            placeholder={type === "LEND" ? "Deposit for…" : "Bike from…"}
            onChange={(e) => setName(e.target.value)}
            data-autofocus
          />
        </label>
        <div className="form-grid">
          <AmountField
            label={words.kind}
            currency={currency}
            value={amountText}
            onChange={setAmountText}
          />
          <label>
            Currency
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setAccountAmount("");
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <AccountBooking
            accounts={accounts}
            accountId={accountId}
            onAccount={chooseAccount}
            currency={currency}
            accountAmount={accountAmount}
            onAccountAmount={setAccountAmount}
            label={type === "LEND" ? "Paid from" : "Received into"}
            hint="Moves the account balance; never counts as income or spending."
          />
          <label>
            Date
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
        </div>
        <ColourPicker value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <label>
          Note
          <textarea
            value={note}
            maxLength={2000}
            placeholder="Optional"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary editor-save" disabled={busy}>
            {busy ? "Saving…" : loan ? "Save changes" : "Add loan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Add or edit a loan record (more lent/borrowed, or a repayment). */
export function LoanRecordModal({
  loan,
  record,
  initialType = "DECREASE",
  accounts,
  onClose,
  onSaved,
}: {
  loan: Loan;
  record?: LoanRecord;
  initialType?: LoanRecordType;
  accounts: Account[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const words = loanWords(loan.type);
  const [type, setType] = useState<LoanRecordType>(record?.type ?? initialType);
  const [amountText, setAmountText] = useState(
    record ? minorToInput(record.amount) : "",
  );
  const [accountId, setAccountId] = useState(
    record ? (record.account_id ?? "") : (loan.account_id ?? ""),
  );
  const [accountAmount, setAccountAmount] = useState("");
  const [day, setDay] = useState(
    record ? dateInput(new Date(record.occurred_at)) : dateInput(new Date()),
  );
  const [note, setNote] = useState(record?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const moneyIn = (loan.type === "LEND") === (type === "DECREASE");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!amount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const occurred = pickedDate(day);
    if (!occurred) {
      setError("Choose a date.");
      return;
    }
    const body: Record<string, unknown> = {
      type,
      amount,
      note: note.trim(),
      account_id: accountId || null,
    };
    if (!record || day !== dateInput(new Date(record.occurred_at)))
      body.occurred_at = occurred;
    if (accountAmount.trim()) {
      const booked = parseAmount(accountAmount);
      if (!booked) {
        setError("The booked amount must be greater than zero.");
        return;
      }
      body.account_amount = booked;
    }
    setBusy(true);
    setError("");
    try {
      await walletWrite(
        record
          ? `/api/v1/loan-records/${record.id}`
          : `/api/v1/loans/${loan.id}/records`,
        record ? "PATCH" : "POST",
        body,
      );
      onSaved(record ? "Record updated." : "Record added.");
    } catch (cause) {
      setError(errorText(cause, "Could not save the record."));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!record) return;
    setBusy(true);
    try {
      await walletWrite(`/api/v1/loan-records/${record.id}`, "DELETE");
      onSaved("Record deleted.");
    } catch (cause) {
      setError(errorText(cause, "Could not delete the record."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={record ? "Edit record" : "Add a record"}
      subtitle={`${loan.name} · amounts in ${loan.currency}.`}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit} noValidate>
        <Segmented<LoanRecordType>
          className="txn-type"
          label="Type"
          options={[
            { value: "DECREASE", label: words.decrease },
            { value: "INCREASE", label: words.increase },
          ]}
          value={type}
          onChange={setType}
        />
        <AmountField
          autoFocus
          label="Amount"
          currency={loan.currency}
          value={amountText}
          onChange={setAmountText}
        />
        <AccountBooking
          accounts={accounts}
          accountId={accountId}
          onAccount={(id) => {
            setAccountId(id);
            setAccountAmount("");
          }}
          currency={loan.currency}
          accountAmount={accountAmount}
          onAccountAmount={setAccountAmount}
          label={moneyIn ? "Received into" : "Paid from"}
          hint="Optional. Moves the account balance only."
        />
        <label>
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </label>
        <label>
          Note
          <input
            value={note}
            maxLength={500}
            placeholder="Optional"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {confirmDelete ? (
          <div className="confirm-inline" role="group" aria-label="Confirm">
            <p>Delete this record? Its account booking is removed too.</p>
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
            {record && (
              <button
                type="button"
                className="button danger"
                onClick={() => setConfirmDelete(true)}
              >
                <DeleteOutlined /> Delete
              </button>
            )}
            <button className="button primary editor-save" disabled={busy}>
              {busy ? "Saving…" : record ? "Save changes" : "Add record"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
