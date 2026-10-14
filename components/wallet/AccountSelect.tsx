"use client";
import { useEffect, useState } from "react";
import { apiFetch, readApiCache } from "../../lib/api";
import { Account, Page, sortAccounts } from "../../lib/wallet";

/** The current user's active wallet accounts (empty until loaded or on error). */
export function useAccounts() {
  const cached = readApiCache<Page<Account>>("/api/v1/accounts");
  const [accounts, setAccounts] = useState<Account[]>(
    cached ? sortAccounts(cached.data) : [],
  );
  useEffect(() => {
    let cancelled = false;
    apiFetch<Page<Account>>("/api/v1/accounts")
      .then((page) => !cancelled && setAccounts(sortAccounts(page.data)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return accounts;
}

/** "Paid from" / "Received into" picker linking a group payment to a wallet account. */
export function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  name,
  hint,
  currency,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: Account[];
  name?: string;
  hint?: string;
  /** Payment currency: accounts in other currencies are marked. */
  currency?: string;
}) {
  const options = accounts.filter((a) => !a.archived || a.id === value);
  return (
    <label className="account-select">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not tracked in Wallet</option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.currency}
            {currency && a.currency !== currency ? " (converted)" : ""}
          </option>
        ))}
      </select>
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
