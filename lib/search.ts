// GET /api/v1/search?q= response shapes and helpers.

export type SearchTag = { id: string; name: string; color?: string };

export type SearchTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  title: string;
  description: string;
  amount: number;
  currency: string;
  account_id: string | null;
  account_name: string | null;
  category_id: string | null;
  occurred_at: string | null;
  due_at: string | null;
  planned: boolean;
  source: string;
  tags: SearchTag[];
};

export type SearchAccount = {
  id: string;
  name: string;
  currency: string;
  color?: string;
  icon?: string;
};

export type SearchLoan = {
  id: string;
  name: string;
  type: "LEND" | "BORROW";
  amount: number;
  currency: string;
  remaining: number;
  paid_off: boolean;
};

export type SearchPlanned = {
  id: string;
  title: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  currency: string;
  next_due_at: string | null;
  one_time: boolean;
  interval_n: number;
  interval_unit: string;
  active: boolean;
};

export type SearchBudget = {
  id: string;
  name: string;
  amount: number;
  currency: string;
};
export type SearchCategory = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};

export type SearchResults = {
  users: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  expenses: {
    id: string;
    group_id: string;
    description: string;
    amount: number;
    currency: string;
  }[];
  transactions: SearchTransaction[];
  accounts: SearchAccount[];
  loans: SearchLoan[];
  planned: SearchPlanned[];
  budgets: SearchBudget[];
  categories: SearchCategory[];
  tags: SearchTag[];
};

const KEYS = [
  "users",
  "groups",
  "expenses",
  "transactions",
  "accounts",
  "loans",
  "planned",
  "budgets",
  "categories",
  "tags",
] as const;

/** The API always sends every key, but an older server may omit the wallet ones. */
export function normalizeSearch(
  raw: Partial<SearchResults> | null | undefined,
) {
  const out = {} as Record<(typeof KEYS)[number], unknown[]>;
  for (const key of KEYS) {
    const value = raw?.[key];
    out[key] = Array.isArray(value) ? value : [];
  }
  return out as unknown as SearchResults;
}

export const searchCount = (results: SearchResults) =>
  KEYS.reduce((n, key) => n + results[key].length, 0);

export const hasAnyResults = (results: SearchResults) =>
  searchCount(results) > 0;

/** "every 2 weeks", "monthly", "one-time" for a planned result. */
export function cadenceText(
  p: Pick<SearchPlanned, "one_time" | "interval_n" | "interval_unit">,
) {
  if (p.one_time) return "one-time";
  const unit = p.interval_unit.toLowerCase();
  if (p.interval_n === 1)
    return (
      { day: "daily", week: "weekly", month: "monthly", year: "yearly" }[
        unit
      ] ?? `every ${unit}`
    );
  return `every ${p.interval_n} ${unit}s`;
}
