"use client";
import Link from "next/link";
import { LockOutlined } from "@ant-design/icons";
import {
  Account,
  colourCss,
  entryDirection,
  formatMoney,
  LedgerEntry,
  WalletCategory,
} from "../../lib/wallet";

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "Planned";

const fullDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Planned";

function amountFor(entry: LedgerEntry, accountId?: string) {
  // From one account's point of view show its signed effect in its currency.
  if (accountId) {
    if (entry.to_account_id === accountId && entry.to_account_amount != null)
      return {
        text: formatMoney(
          entry.to_account_amount,
          entry.to_currency || entry.currency,
          {
            sign: "always",
          },
        ),
        dir: "in" as const,
      };
    if (entry.account_id === accountId && entry.account_amount != null)
      return {
        text: formatMoney(entry.account_amount, entry.currency, {
          sign: "always",
        }),
        dir: entry.account_amount < 0 ? ("out" as const) : ("in" as const),
      };
  }
  const dir = entryDirection(entry);
  if (entry.type === "TRANSFER") {
    const sent = formatMoney(entry.amount, entry.currency);
    const received =
      entry.to_currency &&
      entry.to_currency !== entry.currency &&
      entry.to_amount
        ? ` → ${formatMoney(entry.to_amount, entry.to_currency)}`
        : "";
    return { text: sent + received, dir };
  }
  return {
    text: formatMoney(entry.amount, entry.currency, {
      sign: dir === "in" ? "+" : dir === "out" ? "-" : undefined,
    }),
    dir,
  };
}

export function LedgerTable({
  entries,
  accounts,
  categories,
  accountId,
  onOpen,
  caption = "Transactions",
}: {
  entries: LedgerEntry[];
  accounts: Record<string, Account>;
  categories: Record<string, WalletCategory>;
  /** When set, amounts show this account's own signed effect. */
  accountId?: string;
  onOpen?: (entry: LedgerEntry) => void;
  caption?: string;
}) {
  return (
    <div className="ledger-wrap">
      <table className="ledger-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Title</th>
            <th scope="col">Account</th>
            <th scope="col">Category</th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const category = entry.category_id
              ? categories[entry.category_id]
              : undefined;
            const from = entry.account_id
              ? accounts[entry.account_id]?.name || "Deleted account"
              : undefined;
            const to = entry.to_account_id
              ? accounts[entry.to_account_id]?.name || "Deleted account"
              : undefined;
            const accountText =
              entry.type === "TRANSFER"
                ? `${from ?? "—"} → ${to ?? "—"}`
                : (from ??
                  (entry.kind === "GROUP_EXPENSE"
                    ? "Not from an account"
                    : "—"));
            const label =
              entry.title ||
              category?.name ||
              (entry.type === "SETTLEMENT"
                ? "Settlement"
                : entry.type.charAt(0) + entry.type.slice(1).toLowerCase());
            const amount = amountFor(entry, accountId);
            const categoryText =
              entry.type === "TRANSFER"
                ? "Transfer"
                : entry.type === "SETTLEMENT"
                  ? "Settlement"
                  : (category?.name ?? "Uncategorized");
            const groupHref =
              entry.kind === "GROUP_EXPENSE" && entry.expense_id
                ? `/expenses/${entry.expense_id}`
                : entry.group_id
                  ? `/groups/${entry.group_id}`
                  : undefined;
            return (
              <tr
                key={`${entry.kind}-${entry.id}`}
                className={`dir-${amount.dir}`}
              >
                <td className="ledger-date">
                  <time
                    dateTime={entry.occurred_at ?? undefined}
                    title={fullDate(entry.occurred_at)}
                  >
                    {shortDate(entry.occurred_at)}
                  </time>
                </td>
                <td className="ledger-title">
                  {entry.read_only ? (
                    groupHref ? (
                      <Link href={groupHref} className="ledger-open">
                        {label}
                      </Link>
                    ) : (
                      <span>{label}</span>
                    )
                  ) : onOpen ? (
                    <button
                      type="button"
                      className="ledger-open"
                      onClick={() => onOpen(entry)}
                    >
                      {label}
                    </button>
                  ) : (
                    <span>{label}</span>
                  )}
                  {entry.group_name && (
                    <span className="group-badge" title="Edit it in the group">
                      <LockOutlined aria-hidden="true" /> {entry.group_name}
                    </span>
                  )}
                  {entry.source === "ADJUSTMENT" && (
                    <span className="group-badge">Adjustment</span>
                  )}
                  {(entry.tags ?? []).map((tag) => (
                    <span
                      key={tag.id}
                      className="tag-badge"
                      style={{ ["--chip" as string]: colourCss(tag.color) }}
                    >
                      #{tag.name}
                    </span>
                  ))}
                </td>
                <td className="ledger-account">{accountText}</td>
                <td className="ledger-category">
                  {category && (
                    <i
                      className="dot"
                      style={{ ["--dot" as string]: colourCss(category.color) }}
                      aria-hidden="true"
                    />
                  )}
                  {categoryText}
                </td>
                <td className={`num ledger-amount amount-${amount.dir}`}>
                  <span>{amount.text}</span>
                  {entry.kind === "GROUP_EXPENSE" &&
                    entry.total_amount != null && (
                      <small>
                        {accountId && entry.account_id === accountId
                          ? `paid in full · your share ${formatMoney(entry.amount, entry.currency)}`
                          : `your share of ${formatMoney(entry.total_amount, entry.currency)}`}
                      </small>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
