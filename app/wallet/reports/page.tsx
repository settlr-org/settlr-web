"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  DownloadOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { AppShell } from "../../../components/AppShell";
import {
  Empty,
  ErrorState,
  LoadError,
  Loading,
  Panel,
} from "../../../components/UI";
import { PeriodSelector } from "../../../components/wallet/PeriodSelector";
import { LedgerTable } from "../../../components/wallet/LedgerTable";
import { TransactionEditor } from "../../../components/wallet/TransactionEditor";
import { CategoryDonut } from "../../../components/wallet/reports/CategoryDonut";
import { TrendChart } from "../../../components/wallet/reports/TrendChart";
import { FilterSheet } from "../../../components/wallet/reports/FilterSheet";
import {
  ByAccount,
  ByAccountTable,
} from "../../../components/wallet/reports/ByAccountTable";
import {
  accountMap,
  categoryMap,
  errorText,
  useWalletRefs,
} from "../../../components/wallet/data";
import { useSession } from "../../../components/SessionProvider";
import { apiDownload, apiFetch, ApiError } from "../../../lib/api";
import { plural } from "../../../lib/format";
import { toLoadFailure, type LoadFailure } from "../../../lib/errors";
import {
  activeFilters,
  apiFilterParams,
  Bucket,
  CategoryRow,
  chooseBucket,
  clearFilters,
  coarser,
  filtersPeriod,
  groupSlices,
  parseFilters,
  periodDates,
  PRESETS,
  presetPeriod,
  removeFilter,
  ReportFilters,
  serializeFilters,
  Slice,
  TrendBucket,
} from "../../../lib/reports";
import {
  formatMoney,
  LedgerEntry,
  missingRatesText,
  Page,
  Period,
} from "../../../lib/wallet";

type Report = {
  currency: string;
  income: number;
  expense: number;
  net: number;
  transfers_in: number;
  transfers_out: number;
  count: number;
  treat_transfers_as_flow: boolean;
  missing_rates?: string[];
  by_category: CategoryRow[];
  by_account: ByAccount[];
};
type Trend = { buckets: TrendBucket[]; bucket: Bucket };

function ReportsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { refs, error: refsError, reload } = useWalletRefs();
  const { user } = useSession();
  const search = params.toString();
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(search)),
    [search],
  );
  const startDay = refs?.settings.month_start_day ?? 1;
  const period = useMemo(
    () => filtersPeriod(filters, startDay),
    [filters, startDay],
  );

  const setFilters = useCallback(
    (next: ReportFilters) => {
      const qs = serializeFilters(next).toString();
      router.replace(qs ? `/wallet/reports?${qs}` : "/wallet/reports", {
        scroll: false,
      });
    },
    [router],
  );
  const setPeriod = (p: Period) =>
    setFilters({ ...filters, ...periodDates(p) });

  const apiQuery = useMemo(
    () => apiFilterParams(filters, period).toString(),
    [filters, period],
  );
  const bucket: Bucket = filters.bucket ?? chooseBucket(period);

  const [report, setReport] = useState<Report>();
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [trend, setTrend] = useState<Trend>();
  const [trendError, setTrendError] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [entriesError, setEntriesError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Totals + category breakdown.
  useEffect(() => {
    let cancelled = false;
    setFailure(null);
    apiFetch<Report>(
      `/api/v1/reports?${apiQuery}&breakdown=${filters.breakdown}`,
    )
      .then((r) => !cancelled && setReport(r))
      .catch(
        (x) =>
          !cancelled &&
          setFailure(toLoadFailure(x, "Could not load the report.")),
      );
    return () => {
      cancelled = true;
    };
  }, [apiQuery, filters.breakdown, reloadKey]);

  // Trend: fall back to a coarser bucket when the range has too many buckets.
  useEffect(() => {
    let cancelled = false;
    setTrendError("");
    const run = async (b: Bucket): Promise<void> => {
      try {
        const t = await apiFetch<{ buckets: TrendBucket[] }>(
          `/api/v1/reports/trend?${apiQuery}&bucket=${b}`,
        );
        if (!cancelled) setTrend({ buckets: t.buckets ?? [], bucket: b });
      } catch (x) {
        const next = coarser(b);
        if (x instanceof ApiError && x.status === 422 && next) return run(next);
        if (!cancelled)
          setTrendError(errorText(x, "Could not load the chart."));
      }
    };
    void run(bucket);
    return () => {
      cancelled = true;
    };
  }, [apiQuery, bucket, reloadKey]);

  // Matching entries: same filters as the report.
  useEffect(() => {
    let cancelled = false;
    setEntriesError("");
    apiFetch<Page<LedgerEntry>>(`/api/v1/ledger?${apiQuery}&limit=30`)
      .then((page) => {
        if (cancelled) return;
        setEntries(page.data);
        setCursor(page.next_cursor);
      })
      .catch(
        (x) =>
          !cancelled &&
          setEntriesError(errorText(x, "Could not load entries.")),
      );
    return () => {
      cancelled = true;
    };
  }, [apiQuery, reloadKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Page<LedgerEntry>>(
        `/api/v1/ledger?${apiQuery}&limit=30&cursor=${encodeURIComponent(cursor)}`,
      );
      setEntries((list) => [...list, ...page.data]);
      setCursor(page.next_cursor);
    } catch (x) {
      setEntriesError(errorText(x, "Could not load more."));
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError("");
    const d = periodDates(period);
    try {
      await apiDownload(
        `/api/v1/reports/export.csv?${apiQuery}`,
        `settlr-report-${d.from}-${d.to}.csv`,
      );
    } catch (x) {
      setExportError(errorText(x, "Could not export the report."));
    } finally {
      setExporting(false);
    }
  };

  const drill = (slice: Slice) =>
    setFilters({
      ...filters,
      categories: Array.from(new Set([...filters.categories, ...slice.ids])),
    });

  const accounts = refs?.accounts ?? [];
  const accountsById = useMemo(() => accountMap(accounts), [accounts]);
  const categoriesById = useMemo(
    () => categoryMap(refs?.categories ?? []),
    [refs],
  );
  const names = useMemo(
    () => ({
      accounts: Object.fromEntries(accounts.map((a) => [a.id, a.name])),
      categories: Object.fromEntries(
        (refs?.categories ?? []).map((c) => [c.id, c.name]),
      ),
      tags: Object.fromEntries((refs?.tags ?? []).map((t) => [t.id, t.name])),
    }),
    [accounts, refs],
  );
  const chips = activeFilters(filters, names);
  const slices = useMemo(
    () => groupSlices(report?.by_category ?? []),
    [report],
  );
  const currency = report?.currency ?? "NPR";
  const total =
    filters.breakdown === "income"
      ? (report?.income ?? 0)
      : (report?.expense ?? 0);
  const hidden = refs?.settings.hide_balance ?? false;
  const money = (n: number, sign?: "auto" | "+" | "-") =>
    formatMoney(n, currency, { sign, hidden });
  const missing = report?.missing_rates ?? [];

  return (
    <AppShell
      title="Reports"
      eyebrow="WALLET"
      description="Where your money came from and where it went."
      actions={
        <button
          className="button primary"
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting}
          aria-label="Export CSV"
        >
          <DownloadOutlined /> {exporting ? "Preparing…" : "Export CSV"}
        </button>
      }
    >
      <div className="detail-toolbar">
        <Link href="/wallet" className="back-link">
          <ArrowLeftOutlined /> Wallet
        </Link>
      </div>
      {refsError && !refs ? (
        <ErrorState message={refsError} retry={() => void reload()} />
      ) : !refs ? (
        <Loading />
      ) : (
        <>
          <div className="wallet-toolbar">
            <PeriodSelector
              period={period}
              startDay={startDay}
              onChange={setPeriod}
            />
            <div className="button-row">
              <button
                type="button"
                className="button"
                onClick={() => setSheet(true)}
              >
                <FilterOutlined /> Filters
                {chips.length ? ` (${chips.length})` : ""}
              </button>
            </div>
          </div>
          <div
            className="chip-row preset-row"
            role="group"
            aria-label="Quick ranges"
          >
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="chip"
                onClick={() => setPeriod(presetPeriod(p.key, startDay))}
              >
                {p.label}
              </button>
            ))}
          </div>
          {chips.length > 0 && (
            <div
              className="chip-row active-filters"
              role="group"
              aria-label="Active filters"
            >
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="chip active"
                  onClick={() => setFilters(removeFilter(filters, c.key))}
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label} <CloseOutlined aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() => setFilters(clearFilters(filters))}
              >
                Clear all
              </button>
            </div>
          )}
          {exportError && <ErrorState message={exportError} />}
          {failure ? (
            <LoadError
              failure={failure}
              retry={() => setReloadKey((k) => k + 1)}
              backHref="/wallet"
              backLabel="Back to wallet"
            />
          ) : !report ? (
            <Loading />
          ) : (
            <>
              <section className="report-summary" aria-label="Totals">
                <article className="wallet-stat">
                  <span>Income</span>
                  <strong className="amount-in">
                    {formatMoney(report.income, currency, {
                      sign: "+",
                      hidden: refs.settings.hide_income,
                    })}
                  </strong>
                </article>
                <article className="wallet-stat">
                  <span>Spent</span>
                  <strong className="amount-out">
                    {money(report.expense, "-")}
                  </strong>
                </article>
                <article className="wallet-stat">
                  <span>Net</span>
                  <strong
                    className={report.net < 0 ? "is-negative" : "amount-in"}
                  >
                    {money(report.net, "auto")}
                  </strong>
                </article>
                {!report.treat_transfers_as_flow &&
                  (report.transfers_in > 0 || report.transfers_out > 0) && (
                    <article className="wallet-stat">
                      <span>Transfers</span>
                      <strong className="amount-neutral report-transfers">
                        <span>{money(report.transfers_in)} in</span>
                        <span>{money(report.transfers_out)} out</span>
                      </strong>
                    </article>
                  )}
              </section>
              {missing.length > 0 && (
                <p className="wallet-missing report-missing">
                  Some amounts are left out: no rate for{" "}
                  {missingRatesText(missing)}.{" "}
                  <Link href="/settings#rates">
                    Add a rate in Settings → Exchange rates
                  </Link>
                </p>
              )}
              <div className="report-grid">
                <CategoryDonut
                  slices={slices}
                  total={total}
                  currency={currency}
                  breakdown={filters.breakdown}
                  onBreakdown={(b) => setFilters({ ...filters, breakdown: b })}
                  onDrill={drill}
                  hidden={hidden}
                />
                {trendError ? (
                  <ErrorState
                    message={trendError}
                    retry={() => setReloadKey((k) => k + 1)}
                  />
                ) : trend ? (
                  <TrendChart
                    buckets={trend.buckets}
                    bucket={trend.bucket}
                    onBucket={(b) => setFilters({ ...filters, bucket: b })}
                    currency={currency}
                  />
                ) : (
                  <Loading />
                )}
              </div>
              <ByAccountTable
                rows={report.by_account}
                baseCurrency={currency}
                hidden={hidden}
              />
              <Panel className="history-panel">
                <div className="history-head">
                  <h2>Matching entries</h2>
                  <p className="muted-copy" role="status">
                    {plural(report.count, "entry", "entries")} in the totals
                    {!cursor && entries.length > report.count
                      ? ` · ${entries.length} listed, including transfers, loans and adjustments`
                      : ""}
                  </p>
                </div>
                {entriesError && (
                  <ErrorState
                    message={entriesError}
                    retry={() => setReloadKey((k) => k + 1)}
                  />
                )}
                {entries.length ? (
                  <>
                    <LedgerTable
                      entries={entries}
                      accounts={accountsById}
                      categories={categoriesById}
                      onOpen={(entry) => setEditing(entry.id)}
                      caption="Entries matching the report filters"
                    />
                    {cursor && (
                      <button
                        type="button"
                        className="button full load-more"
                        disabled={loadingMore}
                        onClick={() => void loadMore()}
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </button>
                    )}
                  </>
                ) : (
                  !entriesError && (
                    <Empty text="No entries match these filters in this range." />
                  )
                )}
              </Panel>
            </>
          )}
          {sheet && (
            <FilterSheet
              filters={filters}
              accounts={accounts}
              categories={refs.categories}
              tags={refs.tags}
              onApply={(next) => {
                setSheet(false);
                setFilters(next);
              }}
              onClose={() => setSheet(false)}
            />
          )}
          {editing && (
            <TransactionEditor
              key={editing}
              transactionId={editing}
              accounts={refs.accounts}
              categories={refs.categories}
              tags={refs.tags}
              baseCurrency={user?.default_currency || currency}
              onClose={() => setEditing(undefined)}
              onSaved={() => {
                setEditing(undefined);
                setReloadKey((k) => k + 1);
              }}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsView />
    </Suspense>
  );
}
