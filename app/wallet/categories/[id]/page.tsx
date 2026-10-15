"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  LockOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../../components/AppShell";
import {
  Empty,
  ErrorState,
  LoadError,
  Loading,
  Panel,
} from "../../../../components/UI";
import { apiFetch } from "../../../../lib/api";
import {
  buildLedgerQuery,
  CategorySummary,
  formatMoney,
  LedgerEntry,
  missingRatesText,
  Page,
  Period,
  periodContaining,
} from "../../../../lib/wallet";
import {
  accountMap,
  categoryMap,
  errorText,
  useWalletRefs,
} from "../../../../components/wallet/data";
import { PeriodSelector } from "../../../../components/wallet/PeriodSelector";
import { LedgerTable } from "../../../../components/wallet/LedgerTable";
import { TransactionEditor } from "../../../../components/wallet/TransactionEditor";
import { ItemTile } from "../../../../components/wallet/icons";
import { PlannedPanel } from "../../../../components/wallet/PlannedPanel";
import { type LoadFailure, toLoadFailure } from "../../../../lib/errors";

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { refs, reload, error: refsError } = useWalletRefs();
  const [period, setPeriod] = useState<Period>();
  const [summary, setSummary] = useState<CategorySummary>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [editing, setEditing] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const startDay = refs?.settings.month_start_day ?? 1;
  const category = refs?.categories.find((c) => c.id === id);

  useEffect(() => {
    if (refs && !period) setPeriod(periodContaining(new Date(), startDay));
  }, [refs, period, startDay]);

  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    apiFetch<CategorySummary>(
      `/api/v1/categories/${id}/summary${buildLedgerQuery({ period, limit: 30 })}`,
    )
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
        setEntries(s.entries ?? []);
        setCursor(s.next_cursor);
      })
      .catch(
        (cause) =>
          !cancelled &&
          setLoadFailure(toLoadFailure(cause, "Could not load this category.")),
      );
    return () => {
      cancelled = true;
    };
  }, [id, period, reloadKey]);

  const loadMore = async () => {
    if (!cursor || !period) return;
    try {
      const page = await apiFetch<Page<LedgerEntry>>(
        `/api/v1/ledger${buildLedgerQuery({ period, categories: [id], cursor, limit: 30 })}`,
      );
      setEntries((list) => [...list, ...page.data]);
      setCursor(page.next_cursor);
    } catch (cause) {
      setError(errorText(cause, "Could not load more."));
    }
  };

  const accountsById = useMemo(() => accountMap(refs?.accounts ?? []), [refs]);
  const categoriesById = useMemo(
    () => categoryMap(refs?.categories ?? []),
    [refs],
  );
  const currency = summary?.currency || "NPR";

  return (
    <AppShell
      title={category?.name || "Category"}
      eyebrow="WALLET CATEGORY"
      description="Income and spending filed under this category, group shares included."
    >
      <div className="detail-toolbar">
        <Link href="/wallet/categories" className="back-link">
          <ArrowLeftOutlined /> Categories
        </Link>
      </div>
      {error && <ErrorState message={error} />}
      {loadFailure && !summary ? (
        <LoadError
          failure={loadFailure}
          retry={() => setReloadKey((k) => k + 1)}
          backHref="/wallet/categories"
          backLabel="Back to categories"
        />
      ) : !refs || !period ? (
        refsError ? (
          <ErrorState message={refsError} retry={() => void reload()} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <div className="wallet-toolbar">
            <PeriodSelector
              period={period}
              startDay={startDay}
              onChange={setPeriod}
            />
            {category && (
              <span className="category-chip">
                <ItemTile
                  icon={category.icon}
                  color={category.color}
                  size="sm"
                />
                {category.is_system ? (
                  <>
                    <LockOutlined aria-hidden="true" /> Built in
                  </>
                ) : (
                  "Yours"
                )}
              </span>
            )}
          </div>
          <section className="wallet-summary" aria-label="Category summary">
            <article className="wallet-stat">
              <span>Spent</span>
              <strong className="amount-out">
                {summary
                  ? formatMoney(summary.expense, currency, { sign: "-" })
                  : "…"}
              </strong>
            </article>
            <article className="wallet-stat">
              <span>Income</span>
              <strong className="amount-in">
                {summary
                  ? formatMoney(summary.income, currency, {
                      sign: "+",
                      hidden: refs.settings.hide_income,
                    })
                  : "…"}
              </strong>
            </article>
            <article className="wallet-stat">
              <span>Entries</span>
              <strong>{summary?.count ?? "…"}</strong>
              {(summary?.missing_rates ?? []).length > 0 && (
                <small className="wallet-missing">
                  <WarningOutlined aria-hidden="true" /> No rate for{" "}
                  {missingRatesText(summary?.missing_rates)}
                </small>
              )}
            </article>
          </section>
          {notice && (
            <div className="success-banner" role="status">
              {notice}
            </div>
          )}
          <PlannedPanel
            scope={{ categories: [id] }}
            hideWhenEmpty
            upcoming={summary?.upcoming}
            overdue={summary?.overdue}
            periodEnd={period.to}
            accounts={refs.accounts}
            categories={refs.categories}
            tags={refs.tags}
            baseCurrency={currency}
            onChanged={(message) => {
              if (message) setNotice(message);
              void reload();
              setReloadKey((k) => k + 1);
            }}
          />
          <Panel className="history-panel">
            <div className="history-head">
              <h2>Entries</h2>
            </div>
            {entries.length ? (
              <LedgerTable
                entries={entries}
                accounts={accountsById}
                categories={categoriesById}
                onOpen={(entry) => setEditing(entry.id)}
                caption="Entries"
              />
            ) : (
              <Empty
                title="No entries"
                text="Nothing in this category for the period."
              />
            )}
            {cursor && (
              <button
                type="button"
                className="button full load-more"
                onClick={() => void loadMore()}
              >
                Load more
              </button>
            )}
          </Panel>
          {editing && (
            <TransactionEditor
              transactionId={editing}
              accounts={refs.accounts}
              categories={refs.categories}
              tags={refs.tags}
              onClose={() => setEditing(undefined)}
              onSaved={() => {
                setEditing(undefined);
                void reload();
                setReloadKey((k) => k + 1);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
