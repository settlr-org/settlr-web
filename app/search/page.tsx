"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BankOutlined,
  CalendarOutlined,
  DollarOutlined,
  FolderOutlined,
  NumberOutlined,
  SearchOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { useSession } from "../../components/SessionProvider";
import { Empty, ErrorState, Panel, PanelTitle } from "../../components/UI";
import { PlanFormModal } from "../../components/wallet/PlanForm";
import { TransactionEditor } from "../../components/wallet/TransactionEditor";
import { useWalletRefs } from "../../components/wallet/data";
import { apiFetch } from "../../lib/api";
import { formatDate } from "../../lib/dates";
import { plural } from "../../lib/format";
import {
  cadenceText,
  hasAnyResults,
  normalizeSearch,
  searchCount,
  type SearchResults,
} from "../../lib/search";
import { money } from "../../lib/types";
import { formatMoney } from "../../lib/wallet";

export default function Search() {
  const searchParams = useSearchParams();
  const { user } = useSession();
  const { refs } = useWalletRefs();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<SearchResults>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingTxn, setEditingTxn] = useState<string>();
  const [editingPlan, setEditingPlan] = useState<string>();
  const run = async (raw: string) => {
    const term = raw.trim();
    if (term.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setError("");
    try {
      const data = await apiFetch<Partial<SearchResults>>(
        `/api/v1/search?q=${encodeURIComponent(term)}`,
      );
      setResults(normalizeSearch(data));
      setSearched(term);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Search failed.");
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(query);
  };
  // /search?q=cabin (links, bookmarks, the browser's back button) runs the search.
  const ran = useRef("");
  useEffect(() => {
    if (initial.trim().length >= 2 && ran.current !== initial) {
      ran.current = initial;
      setQuery(initial);
      void run(initial);
    }
  }, [initial]);

  const count = results ? searchCount(results) : 0;
  const baseCurrency = user?.default_currency || "NPR";
  const refresh = (message: string) => {
    setEditingTxn(undefined);
    setEditingPlan(undefined);
    setNotice(message);
    void run(searched);
  };

  return (
    <AppShell
      title="Search"
      eyebrow="FIND ANYTHING"
      description="Search your wallet, groups, and people from one place."
    >
      <Panel className="search-workspace">
        <form className="global-search" onSubmit={submit}>
          <SearchOutlined />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
            minLength={2}
            placeholder="Try a person, trip, account, or expense"
            aria-label="Search wallet, groups, and people"
            autoFocus
          />
          <button className="button primary">Search</button>
        </form>
        {error && <ErrorState message={error} />}
        {notice && (
          <p className="search-count" role="status">
            {notice}
          </p>
        )}
        {results && (
          <p className="search-count" role="status">
            {plural(count, "result")} for “{searched}”
          </p>
        )}
      </Panel>
      {results && (
        <div className="search-results-grid">
          {results.transactions.length > 0 && (
            <Panel>
              <PanelTitle
                title="Transactions"
                meta={plural(results.transactions.length, "match", "matches")}
              />
              {results.transactions.map((t) => {
                const name = t.title || t.description || "Transaction";
                const when = t.planned ? t.due_at : t.occurred_at;
                return (
                  <button
                    type="button"
                    className="result-line"
                    key={t.id}
                    onClick={() => setEditingTxn(t.id)}
                  >
                    <SwapOutlined />
                    <span>
                      <strong>
                        {name}
                        {t.planned && (
                          <span className="tag-badge">Planned</span>
                        )}
                      </strong>
                      <small>
                        {formatMoney(t.amount, t.currency)}
                        {when
                          ? ` · ${t.planned ? "due " : ""}${formatDate(when)}`
                          : ""}
                        {t.account_name ? ` · ${t.account_name}` : ""}
                      </small>
                      {t.tags.length > 0 && (
                        <small>
                          {t.tags.map((x) => `#${x.name}`).join(" ")}
                        </small>
                      )}
                    </span>
                  </button>
                );
              })}
            </Panel>
          )}
          {results.accounts.length > 0 && (
            <Panel>
              <PanelTitle
                title="Accounts"
                meta={plural(results.accounts.length, "match", "matches")}
              />
              {results.accounts.map((a) => (
                <Link
                  className="result-line"
                  href={`/wallet/accounts/${a.id}`}
                  key={a.id}
                >
                  <WalletOutlined />
                  <span>
                    <strong>{a.name}</strong>
                    <small>{a.currency}</small>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
          {results.loans.length > 0 && (
            <Panel>
              <PanelTitle
                title="Loans"
                meta={plural(results.loans.length, "match", "matches")}
              />
              {results.loans.map((l) => (
                <Link
                  className="result-line"
                  href={`/wallet/loans/${l.id}`}
                  key={l.id}
                >
                  <BankOutlined />
                  <span>
                    <strong>{l.name}</strong>
                    <small>
                      {l.type === "LEND" ? "Lent" : "Borrowed"} ·{" "}
                      {l.paid_off
                        ? "paid off"
                        : `${formatMoney(l.remaining, l.currency)} left`}
                    </small>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
          {results.planned.length > 0 && (
            <Panel>
              <PanelTitle
                title="Planned payments"
                meta={plural(results.planned.length, "match", "matches")}
              />
              {results.planned.map((p) => (
                <button
                  type="button"
                  className="result-line"
                  key={p.id}
                  onClick={() => setEditingPlan(p.id)}
                >
                  <CalendarOutlined />
                  <span>
                    <strong>{p.title || "Planned payment"}</strong>
                    <small>
                      {formatMoney(p.amount, p.currency)} · {cadenceText(p)}
                      {p.next_due_at
                        ? ` · next ${formatDate(p.next_due_at)}`
                        : ""}
                      {p.active ? "" : " · paused"}
                    </small>
                  </span>
                </button>
              ))}
            </Panel>
          )}
          {results.budgets.length > 0 && (
            <Panel>
              <PanelTitle
                title="Budgets"
                meta={plural(results.budgets.length, "match", "matches")}
              />
              {results.budgets.map((b) => (
                <Link className="result-line" href="/wallet/budgets" key={b.id}>
                  <DollarOutlined />
                  <span>
                    <strong>{b.name}</strong>
                    <small>{formatMoney(b.amount, b.currency)}</small>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
          {results.categories.length > 0 && (
            <Panel>
              <PanelTitle
                title="Categories"
                meta={plural(results.categories.length, "match", "matches")}
              />
              {results.categories.map((c) => (
                <Link
                  className="result-line"
                  href={`/wallet/categories/${c.id}`}
                  key={c.id}
                >
                  <FolderOutlined />
                  <strong>{c.name}</strong>
                </Link>
              ))}
            </Panel>
          )}
          {results.tags.length > 0 && (
            <Panel>
              <PanelTitle
                title="Tags"
                meta={plural(results.tags.length, "match", "matches")}
              />
              {results.tags.map((t) => (
                <Link className="result-line" href="/wallet/tags" key={t.id}>
                  <NumberOutlined />
                  <strong>{t.name}</strong>
                </Link>
              ))}
            </Panel>
          )}
          {results.groups.length > 0 && (
            <Panel>
              <PanelTitle
                title="Groups"
                meta={plural(results.groups.length, "match", "matches")}
              />
              {results.groups.map((item) => (
                <Link
                  className="result-line"
                  href={`/groups/${item.id}`}
                  key={item.id}
                >
                  <TeamOutlined />
                  <strong>{item.name}</strong>
                </Link>
              ))}
            </Panel>
          )}
          {results.expenses.length > 0 && (
            <Panel>
              <PanelTitle
                title="Group expenses"
                meta={plural(results.expenses.length, "match", "matches")}
              />
              {results.expenses.map((item) => (
                <Link
                  className="result-line"
                  href={`/expenses/${item.id}`}
                  key={item.id}
                >
                  <DollarOutlined />
                  <span>
                    <strong>{item.description}</strong>
                    <small>{money(item.amount, item.currency)}</small>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
          {results.users.length > 0 && (
            <Panel>
              <PanelTitle
                title="People"
                meta={plural(results.users.length, "match", "matches")}
              />
              {results.users.map((item) => (
                <Link
                  className="result-line"
                  href={`/friends/${item.id}`}
                  key={item.id}
                >
                  <UserOutlined />
                  <strong>{item.name}</strong>
                </Link>
              ))}
            </Panel>
          )}
          {!hasAnyResults(results) && (
            <Panel>
              <Empty
                icon={<SearchOutlined />}
                title="No matches"
                text="Try a broader name, title, or tag."
              />
            </Panel>
          )}
        </div>
      )}
      {editingTxn && refs && (
        <TransactionEditor
          transactionId={editingTxn}
          accounts={refs.accounts}
          categories={refs.categories}
          tags={refs.tags}
          baseCurrency={baseCurrency}
          onClose={() => setEditingTxn(undefined)}
          onSaved={refresh}
        />
      )}
      {editingPlan && refs && (
        <PlanFormModal
          planId={editingPlan}
          accounts={refs.accounts}
          categories={refs.categories}
          tags={refs.tags}
          baseCurrency={baseCurrency}
          onClose={() => setEditingPlan(undefined)}
          onSaved={refresh}
        />
      )}
    </AppShell>
  );
}
