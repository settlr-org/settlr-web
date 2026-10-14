"use client";
import { useEffect, useMemo, useState } from "react";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { Empty, Panel } from "../UI";
import { apiFetch } from "../../lib/api";
import {
  Account,
  buildLedgerQuery,
  LedgerEntry,
  LedgerFilters,
  LedgerType,
  Page,
  Period,
  Tag,
  WalletCategory,
} from "../../lib/wallet";
import { accountMap, categoryMap, errorText } from "./data";
import { LedgerTable } from "./LedgerTable";

const TYPE_OPTIONS: { value: "" | LedgerType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "EXPENSE", label: "Expenses" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfers" },
  { value: "SETTLEMENT", label: "Settlements" },
];

/** Searchable, filterable history from GET /ledger with cursor paging. */
export function HistoryPanel({
  accounts,
  categories,
  tags,
  period,
  accountId,
  reloadKey,
  onOpen,
  title = "History",
}: {
  accounts: Account[];
  categories: WalletCategory[];
  tags: Tag[];
  period: Period;
  /** Fixes the account filter (account detail page). */
  accountId?: string;
  reloadKey: number;
  onOpen: (entry: LedgerEntry) => void;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | LedgerType>("");
  const [account, setAccount] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce the search box so each keystroke doesn't hit the API.
  useEffect(() => {
    const id = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const filters: LedgerFilters = useMemo(
    () => ({
      period,
      q: query,
      types: type ? [type] : [],
      accounts: accountId ? [accountId] : account ? [account] : [],
      categories: category ? [category] : [],
      tags: tag ? [tag] : [],
      limit: 30,
    }),
    [period, query, type, account, accountId, category, tag],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<Page<LedgerEntry>>(`/api/v1/ledger${buildLedgerQuery(filters)}`)
      .then((page) => {
        if (cancelled) return;
        setEntries(page.data);
        setCursor(page.next_cursor);
      })
      .catch((cause) => {
        if (!cancelled) setError(errorText(cause, "Could not load history."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await apiFetch<Page<LedgerEntry>>(
        `/api/v1/ledger${buildLedgerQuery({ ...filters, cursor })}`,
      );
      setEntries((list) => [...list, ...page.data]);
      setCursor(page.next_cursor);
    } catch (cause) {
      setError(errorText(cause, "Could not load more."));
    } finally {
      setMore(false);
    }
  };

  const active =
    Number(Boolean(type)) +
    Number(Boolean(account)) +
    Number(Boolean(category)) +
    Number(Boolean(tag));
  const accountsById = useMemo(() => accountMap(accounts), [accounts]);
  const categoriesById = useMemo(() => categoryMap(categories), [categories]);

  return (
    <Panel className="history-panel">
      <div className="history-head">
        <h2>{title}</h2>
        <div className="history-tools">
          <label className="search history-search">
            <SearchOutlined aria-hidden="true" />
            <input
              type="search"
              placeholder="Search transactions"
              aria-label="Search transactions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button"
            aria-expanded={showFilters}
            aria-controls="history-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            <FilterOutlined /> Filters{active ? ` (${active})` : ""}
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="history-filters" id="history-filters">
          <label>
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "" | LedgerType)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {!accountId && (
            <label>
              Account
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {active > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setType("");
                setAccount("");
                setCategory("");
                setTag("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div aria-busy={loading} aria-live="polite">
        {loading && !entries.length ? (
          <p className="muted-copy history-status">Loading history…</p>
        ) : entries.length ? (
          <LedgerTable
            entries={entries}
            accounts={accountsById}
            categories={categoriesById}
            accountId={accountId}
            onOpen={onOpen}
            caption={title}
          />
        ) : (
          <Empty
            title="No transactions"
            text={
              query || active
                ? "Nothing matches these filters in this period."
                : "Nothing recorded in this period yet."
            }
          />
        )}
      </div>
      {cursor && (
        <button
          type="button"
          className="button full load-more"
          disabled={more}
          onClick={() => void loadMore()}
        >
          {more ? "Loading…" : "Load more"}
        </button>
      )}
    </Panel>
  );
}
