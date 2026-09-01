"use client";
import { FormEvent, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>();
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setError("");
    try {
      setResults(
        await apiFetch<Results>(
          `/api/v1/search?q=${encodeURIComponent(query.trim())}`,
        ),
      );
    } catch (x) {
      setError(x instanceof Error ? x.message : "Search failed.");
    }
  };
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
            autoFocus
          />
          <button className="button primary">Search</button>
        </form>
        {error && <ErrorState message={error} />}
        {results && (
          <p className="search-count">
            {count} results for “{query}”
          </p>
        )}
      </Panel>
      {results && (
        <div className="search-results-grid">
          <Panel>
            <PanelTitle
              title="Groups"
              meta={`${results.groups.length} matches`}
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
              meta={`${results.expenses.length} matches`}
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
              meta={`${results.users.length} matches`}
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
