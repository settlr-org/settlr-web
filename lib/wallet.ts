// Wallet (accounts, transactions, unified ledger) — types and pure helpers.
// Everything here is framework-free so it can be unit tested in isolation.
import theme from "../theme/theme.json";
import type { Category } from "./types";

export type TxnType = "INCOME" | "EXPENSE" | "TRANSFER";
export type LedgerType = TxnType | "SETTLEMENT";
export type LedgerKind = "TRANSACTION" | "GROUP_EXPENSE" | "SETTLEMENT";

export type Account = {
  id: string;
  name: string;
  currency: string;
  color: string;
  icon: string;
  include_in_balance: boolean;
  is_default: boolean;
  sort_order: number;
  archived: boolean;
  archived_at?: string | null;
  balance: number;
  balance_base?: number | null;
  base_currency: string;
  missing_rates?: string[];
  created_at?: string;
  updated_at?: string;
};

export type TagRef = { id: string; name: string; color?: string };
export type Tag = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
};

export type Transaction = {
  id: string;
  type: TxnType;
  account_id: string | null;
  to_account_id: string | null;
  amount: number;
  currency: string;
  to_amount: number | null;
  category_id: string | null;
  title: string;
  description: string;
  occurred_at: string | null;
  due_at?: string | null;
  source: string;
  tags?: TagRef[];
};

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  type: LedgerType;
  account_id: string | null;
  to_account_id: string | null;
  amount: number;
  currency: string;
  to_amount: number | null;
  to_currency: string | null;
  account_amount: number | null;
  to_account_amount: number | null;
  category_id: string | null;
  title: string;
  description: string;
  occurred_at: string | null;
  source: string;
  group_id: string | null;
  group_name: string | null;
  expense_id: string | null;
  settlement_id: string | null;
  total_amount: number | null;
  read_only: boolean;
  tags?: TagRef[];
};

export type Page<T> = { data: T[]; next_cursor?: string };

export type WalletCategory = Category & {
  is_system?: boolean;
  grouping?: string;
  sort_order?: number | null;
};

export type WalletSettings = {
  month_start_day: number;
  hide_balance: boolean;
  hide_income: boolean;
  treat_transfers_as_flow: boolean;
  theme?: string;
};

export const DEFAULT_SETTINGS: WalletSettings = {
  month_start_day: 1,
  hide_balance: false,
  hide_income: false,
  treat_transfers_as_flow: false,
};

export type Overview = {
  currency: string;
  from: string;
  to: string;
  balance: number;
  income: number;
  expense: number;
  missing_rates?: string[];
};

export type AccountSummary = {
  account_id: string;
  currency: string;
  balance: number;
  income: number;
  expense: number;
  inflow: number;
  outflow: number;
  entries: LedgerEntry[];
  next_cursor?: string;
  missing_rates?: string[];
};

export type CategorySummary = {
  category_id: string;
  currency: string;
  income: number;
  expense: number;
  count: number;
  entries: LedgerEntry[];
  next_cursor?: string;
  missing_rates?: string[];
};

export type RateOverride = {
  base: string;
  quote: string;
  rate: number;
  updated_at?: string;
};

export type FetchedRates = { base: string; rates: Record<string, number> };

/** Currencies the API accepts (internal/auth SupportedCurrencies). */
export const CURRENCIES = [
  "NPR",
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AUD",
  "CAD",
  "JPY",
  "CHF",
  "CNY",
  "SGD",
  "HKD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "ISK",
  "TRY",
  "BRL",
  "MXN",
  "COP",
  "IDR",
  "ILS",
  "KRW",
  "MYR",
  "PHP",
  "THB",
  "VND",
  "ZAR",
  "MKD",
];

// ---------------------------------------------------------------- amounts

/**
 * Evaluates a calculator expression such as "1200*4", "(30+12.5)/2" or
 * "1,200 × 3". Supports + − * / × ÷, parentheses, unary minus and decimals;
 * commas are thousands separators. Returns null for anything else, for
 * division by zero and for non-finite results.
 */
export function evaluateExpression(input: string): number | null {
  const source = input
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!source) return null;
  let pos = 0;
  const peek = () => source[pos];
  const fail = (): never => {
    throw new Error("invalid");
  };
  const number = (): number => {
    const match = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(pos));
    if (!match) fail();
    pos += match![0].length;
    return Number(match![0]);
  };
  const factor = (): number => {
    if (peek() === "-") {
      pos++;
      return -factor();
    }
    if (peek() === "+") {
      pos++;
      return factor();
    }
    if (peek() === "(") {
      pos++;
      const value = expression();
      if (peek() !== ")") fail();
      pos++;
      return value;
    }
    return number();
  };
  const term = (): number => {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const op = source[pos++];
      const right = factor();
      if (op === "/" && right === 0) fail();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = source[pos++];
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  try {
    const value = expression();
    if (pos !== source.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/** True when the input is more than a plain number (so a live result is worth showing). */
export const isExpression = (input: string) =>
  /\d\s*[-+*/×÷xX−]\s*[-(\d.]|\(/.test(input.replace(/,/g, ""));

/** Major units (e.g. 12.345) to integer minor units (1235). */
export const toMinor = (major: number) =>
  Math.round((major + Math.sign(major) * Number.EPSILON) * 100);

/** Parses an amount field (number or expression) to positive minor units, else null. */
export function parseAmount(input: string): number | null {
  const value = evaluateExpression(input);
  if (value === null) return null;
  const minor = toMinor(value);
  return minor > 0 ? minor : null;
}

/** Minor units as a plain editable number string ("1234.5", no grouping). */
export const minorToInput = (minor: number) => String(Math.round(minor) / 100);

/** Masked amount shown when the user hides balances. */
export const HIDDEN_AMOUNT = "•••••";

/**
 * Formats minor units with the currency code (design rule: always show the
 * code). `sign` adds an explicit "+ " / "− " prefix; "auto" signs negatives only.
 */
export function formatMoney(
  minor: number,
  currency = "NPR",
  options: { sign?: "+" | "-" | "auto" | "always"; hidden?: boolean } = {},
): string {
  if (options.hidden) return `${currency} ${HIDDEN_AMOUNT}`;
  let body: string;
  try {
    body = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(minor) / 100);
  } catch {
    body = `${currency} ${(Math.abs(minor) / 100).toFixed(2)}`;
  }
  const sign =
    options.sign === "+"
      ? "+ "
      : options.sign === "-"
        ? "− "
        : options.sign === "always"
          ? minor < 0
            ? "− "
            : minor > 0
              ? "+ "
              : ""
          : minor < 0
            ? "− "
            : "";
  return `${sign}${body}`;
}

/** Direction of a ledger row for colouring and sign: in, out or neutral. */
export function entryDirection(
  entry: Pick<LedgerEntry, "type" | "account_amount" | "kind">,
  accountId?: string,
  entryAccountId?: string | null,
): "in" | "out" | "neutral" {
  if (entry.type === "INCOME") return "in";
  if (entry.type === "EXPENSE") return "out";
  if (entry.type === "SETTLEMENT") {
    if (entry.account_amount == null) return "neutral";
    return entry.account_amount < 0 ? "out" : "in";
  }
  // Transfers are neutral overall but have a direction from one account's view.
  if (accountId) return entryAccountId === accountId ? "out" : "in";
  return "neutral";
}

// ---------------------------------------------------------------- periods

export type Period = { from: Date; to: Date; custom?: boolean };

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The budgeting "month" that contains `date`, starting on `startDay` (1–28), in local time. */
export function periodContaining(date: Date, startDay = 1): Period {
  const day = Math.min(Math.max(Math.trunc(startDay) || 1, 1), 28);
  let from = new Date(date.getFullYear(), date.getMonth(), day);
  if (startOfDay(date) < from)
    from = new Date(date.getFullYear(), date.getMonth() - 1, day);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, day);
  return { from, to };
}

/** Moves a month period by `delta` months. Custom ranges move by their own length. */
export function shiftPeriod(
  period: Period,
  delta: number,
  startDay = 1,
): Period {
  if (period.custom) {
    const length = period.to.getTime() - period.from.getTime();
    const days = Math.round(length / 86_400_000);
    return {
      from: new Date(
        period.from.getFullYear(),
        period.from.getMonth(),
        period.from.getDate() + days * delta,
      ),
      to: new Date(
        period.to.getFullYear(),
        period.to.getMonth(),
        period.to.getDate() + days * delta,
      ),
      custom: true,
    };
  }
  const anchor = new Date(
    period.from.getFullYear(),
    period.from.getMonth() + delta,
    Math.min(Math.max(startDay, 1), 28),
  );
  return periodContaining(anchor, startDay);
}

/** Custom period from two YYYY-MM-DD dates; `to` is inclusive. */
export function customPeriod(from: string, to: string): Period | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (!a || !b || b < a) return null;
  return {
    from: a,
    to: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1),
    custom: true,
  };
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "October 2026" for calendar months, else "15 Oct – 14 Nov 2026". */
export function periodLabel(period: Period, locale?: string): string {
  const lastDay = new Date(
    period.to.getFullYear(),
    period.to.getMonth(),
    period.to.getDate() - 1,
  );
  if (
    !period.custom &&
    period.from.getDate() === 1 &&
    sameDay(
      new Date(period.from.getFullYear(), period.from.getMonth() + 1, 1),
      period.to,
    )
  )
    return period.from.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  const sameYear = period.from.getFullYear() === lastDay.getFullYear();
  const start = period.from.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const end = lastDay.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return sameDay(period.from, lastDay) ? end : `${start} – ${end}`;
}

/** Query params for a period: RFC 3339 instants, `to` exclusive. */
export const periodParams = (period: Period) => ({
  from: period.from.toISOString(),
  to: period.to.toISOString(),
});

/** YYYY-MM-DD in local time. */
export const dateInput = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");

/** Value for <input type="datetime-local"> in local time. */
export const dateTimeInput = (d: Date) =>
  `${dateInput(d)}T${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

// ---------------------------------------------------------------- rates

export type ResolvedRate = {
  rate: number;
  source: "same" | "override" | "fetched";
};

/** 1 `from` = rate `to`, preferring the user's overrides (either direction) over fetched rates. */
export function resolveRate(
  from: string,
  to: string,
  overrides: RateOverride[] = [],
  fetched?: FetchedRates | null,
): ResolvedRate | null {
  if (from === to) return { rate: 1, source: "same" };
  const direct = overrides.find((o) => o.base === from && o.quote === to);
  if (direct && direct.rate > 0)
    return { rate: direct.rate, source: "override" };
  const inverse = overrides.find((o) => o.base === to && o.quote === from);
  if (inverse && inverse.rate > 0)
    return { rate: 1 / inverse.rate, source: "override" };
  if (fetched?.base === from && fetched.rates[to] > 0)
    return { rate: fetched.rates[to], source: "fetched" };
  if (fetched?.base === to && fetched.rates[from] > 0)
    return { rate: 1 / fetched.rates[from], source: "fetched" };
  return null;
}

/** Converts minor units with a rate, rounding to the nearest minor unit. */
export const convertMinor = (minor: number, rate: number) =>
  Math.round(minor * rate);

/**
 * The to_amount to send for a transfer: omitted (null) for same-currency
 * transfers, the user's manual entry when given, else the converted amount.
 */
export function transferToAmount(input: {
  amount: number | null;
  fromCurrency?: string;
  toCurrency?: string;
  manual?: number | null;
  rate?: number | null;
}): number | null {
  const { amount, fromCurrency, toCurrency, manual, rate } = input;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return null;
  if (manual && manual > 0) return manual;
  if (!amount || !rate) return null;
  const converted = convertMinor(amount, rate);
  return converted > 0 ? converted : null;
}

// ---------------------------------------------------------------- queries

export type LedgerFilters = {
  q?: string;
  types?: LedgerType[];
  accounts?: string[];
  categories?: string[];
  tags?: string[];
  groups?: string[];
  kinds?: LedgerKind[];
  period?: Period;
  cursor?: string;
  limit?: number;
};

/** Builds the query string for GET /ledger and /transactions (empty filters are omitted). */
export function buildLedgerQuery(filters: LedgerFilters): string {
  const params = new URLSearchParams();
  if (filters.period) {
    const { from, to } = periodParams(filters.period);
    params.set("from", from);
    params.set("to", to);
  }
  const list = (key: string, values?: string[]) => {
    const clean = (values ?? []).map((v) => v.trim()).filter(Boolean);
    if (clean.length) params.set(key, Array.from(new Set(clean)).join(","));
  };
  list("type", filters.types);
  list("kind", filters.kinds);
  list("account", filters.accounts);
  list("category", filters.categories);
  list("tag", filters.tags);
  list("group", filters.groups);
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------- colours

const CHART_KEYS = [
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
  "chart6",
  "chart7",
  "chart8",
] as const;
type ChartKey = (typeof CHART_KEYS)[number];
const lightTokens = theme.modes.light as Record<string, string>;

/**
 * Colours users can pick for accounts, categories and tags. The stored value
 * is the light-mode hex of a theme chart token (so Android and older clients
 * can render it), and the UI maps it back to the token so dark mode adapts.
 */
export const PALETTE = CHART_KEYS.map((key: ChartKey, index) => ({
  key,
  label: `Colour ${index + 1}`,
  stored: lightTokens[key],
  css: `var(--st-${key})`,
}));

/** CSS colour for a stored colour: theme tokens for palette values, data colours as-is. */
export function colourCss(stored?: string | null): string {
  if (!stored) return "var(--st-chart1)";
  const token = PALETTE.find(
    (p) => p.stored.toLowerCase() === stored.toLowerCase(),
  );
  if (token) return token.css;
  if (/^chart[1-8]$/.test(stored)) return `var(--st-${stored})`;
  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(stored)
    ? stored
    : "var(--st-chart1)";
}

/** Next palette colour to suggest for a new item. */
export const suggestColour = (count: number) =>
  PALETTE[count % PALETTE.length].stored;

// ---------------------------------------------------------------- misc

/** Account list order: sort_order, then name; archived last. */
export const sortAccounts = (accounts: Account[]) =>
  [...accounts].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

/** Moves the item at `index` by `delta` positions, returning a new array. */
export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length) return items;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** Human text for missing currency pairs, e.g. "USD→NPR, EUR→NPR". */
export const missingRatesText = (pairs?: string[]) =>
  (pairs ?? []).map((p) => p.replace("/", "→")).join(", ");

/** Settlement rows: true when the signed account effect means money came in. */
export const isInflow = (entry: Pick<LedgerEntry, "account_amount">) =>
  (entry.account_amount ?? 0) > 0;
