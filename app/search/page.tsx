"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DollarOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { AppShell } from "../../components/AppShell";
import { Empty, ErrorState, Panel, PanelTitle } from "../../components/UI";
import { apiFetch } from "../../lib/api";
import { money } from "../../lib/types";
import { plural } from "../../lib/format";

type Results = {
  users: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  expenses: {
    id: string;
    group_id: string;
    description: string;
    amount: number;
    currency: string;
  }[];
};
export default function Search() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<Results>();
  const [error, setError] = useState("");
  const run = async (raw: string) => {
    const term = raw.trim();
    if (term.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setError("");
    try {
      setResults(
        await apiFetch<Results>(`/api/v1/search?q=${encodeURIComponent(term)}`),
      );
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
  const count = results
    ? results.users.length + results.groups.length + results.expenses.length
    : 0;
  return (
    <AppShell
      title="Search"
      eyebrow="FIND ANYTHING"
      description="Search people, groups, and expenses from one place."
    >
      <Panel className="search-workspace">
        <form className="global-search" onSubmit={submit}>
          <SearchOutlined />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
            minLength={2}
            placeholder="Try a person, trip, or expense"
            aria-label="Search people, groups, and expenses"
            autoFocus
          />
          <button className="button primary">Search</button>
        </form>
        {error && <ErrorState message={error} />}
        {results && (
          <p className="search-count">
            {plural(count, "result")} for “{searched}”
          </p>
        )}
      </Panel>
      {results && (
        <div className="search-results-grid">
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
          <Panel>
            <PanelTitle
              title="Expenses"
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
          {!count && (
            <Panel>
              <Empty
                icon={<SearchOutlined />}
                text="Try a broader name or description."
              />
            </Panel>
          )}
        </div>
      )}
    </AppShell>
  );
}
