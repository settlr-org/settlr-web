// Wallet reports: filter state <-> URL query string <-> API query, plus the
// pure helpers behind the charts. Framework-free so it can be unit tested.
import {
  customPeriod,
  shiftPeriod,
  dateInput,
  parseAmount,
  Period,
  periodContaining,
  TxnType,
} from "./wallet";

export type Breakdown = "expense" | "income";
export type Bucket = "day" | "week" | "month";
export type PlannedMode = "false" | "all";

export type ReportFilters = {
  /** Inclusive local dates (YYYY-MM-DD); both unset means the current period. */
  from?: string;
  to?: string;
  types: TxnType[];
  accounts: string[];
  /** Category ids, or "none" for uncategorised. */
  categories: string[];
  tags: string[];
  exclTags: string[];
  q: string;
  exclQ: string;
  /** Amounts as typed (major units), e.g. "12.50". */
  min: string;
  max: string;
  groupShares: boolean;
  planned: PlannedMode;
  hideAdjustments: boolean;
  breakdown: Breakdown;
  bucket?: Bucket;
};

export const DEFAULT_FILTERS: ReportFilters = {
  types: [],
  accounts: [],
  categories: [],
  tags: [],
  exclTags: [],
  q: "",
  exclQ: "",
  min: "",
  max: "",
  groupShares: true,
  planned: "false",
  hideAdjustments: false,
  breakdown: "expense",
};

const TYPES: TxnType[] = ["INCOME", "EXPENSE", "TRANSFER"];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (value: string | null) => {
  if (!value || !DATE.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) || dateInput(d) !== value
    ? undefined
    : value;
};
const list = (
  value: string | null,
  allow: (v: string) => boolean = (v) => ID.test(v),
) =>
  Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v && allow(v)),
    ),
  );
const amountText = (value: string | null) => {
  const v = (value ?? "").trim();
  const minor = parseAmount(v);
  return v && minor !== null && minor >= 0 ? v : "";
};
const MAX_TEXT = 200;

/** Reads and validates filters from a URL query; anything invalid is dropped. */
export function parseFilters(params: URLSearchParams): ReportFilters {
  let from = validDate(params.get("from"));
  let to = validDate(params.get("to"));
  if (!from || !to || to < from) {
    from = undefined;
    to = undefined;
  }
  const bucket = params.get("bucket");
  const planned = params.get("planned");
  const min = amountText(params.get("min"));
  let max = amountText(params.get("max"));
  if (min && max && (parseAmount(min) ?? 0) > (parseAmount(max) ?? 0)) max = "";
  return {
    from,
    to,
    types: list(params.get("type"), (v) =>
      TYPES.includes(v as TxnType),
    ) as TxnType[],
    accounts: list(params.get("account")),
    categories: list(params.get("category")),
    tags: list(params.get("tag")),
    exclTags: list(params.get("excl_tag")),
    q: (params.get("q") ?? "").trim().slice(0, MAX_TEXT),
    exclQ: (params.get("excl_q") ?? "").trim().slice(0, MAX_TEXT),
    min,
    max,
    groupShares: params.get("include_group_shares") !== "false",
    planned: planned === "all" || planned === "true" ? "all" : "false",
    hideAdjustments: params.get("hide_adjustments") === "true",
    breakdown: params.get("breakdown") === "income" ? "income" : "expense",
    bucket:
      bucket === "day" || bucket === "week" || bucket === "month"
        ? bucket
        : undefined,
  };
}

/** Writes only non-default values, so URLs stay short and shareable. */
export function serializeFilters(f: ReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.from && f.to) {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  const put = (key: string, values: string[]) =>
    values.length && p.set(key, values.join(","));
  put("type", f.types);
  put("account", f.accounts);
  put("category", f.categories);
  put("tag", f.tags);
  put("excl_tag", f.exclTags);
  if (f.q) p.set("q", f.q);
  if (f.exclQ) p.set("excl_q", f.exclQ);
  if (f.min) p.set("min", f.min);
  if (f.max) p.set("max", f.max);
  if (!f.groupShares) p.set("include_group_shares", "false");
  if (f.planned === "all") p.set("planned", "all");
  if (f.hideAdjustments) p.set("hide_adjustments", "true");
  if (f.breakdown === "income") p.set("breakdown", "income");
  if (f.bucket) p.set("bucket", f.bucket);
  return p;
}

/** The period the filters describe (or the current one for `startDay`). */
export function filtersPeriod(
  f: Pick<ReportFilters, "from" | "to">,
  startDay: number,
  now = new Date(),
): Period {
  if (f.from && f.to) {
    const custom = customPeriod(f.from, f.to);
    if (custom) {
      const month = periodContaining(custom.from, startDay);
      const same =
        month.from.getTime() === custom.from.getTime() &&
        month.to.getTime() === custom.to.getTime();
      return same ? month : custom;
    }
  }
  return periodContaining(now, startDay);
}

/** Inclusive YYYY-MM-DD pair for a period (what the URL stores). */
export const periodDates = (period: Period) => ({
  from: dateInput(period.from),
  to: dateInput(
    new Date(
      period.to.getFullYear(),
      period.to.getMonth(),
      period.to.getDate() - 1,
    ),
  ),
});

/**
 * Filter params shared by /ledger, /transactions, /reports, /reports/trend and
 * /reports/export.csv. Dates go as local-midnight instants (`to` exclusive).
 */
export function apiFilterParams(
  f: ReportFilters,
  period: Period,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("from", period.from.toISOString());
  p.set("to", period.to.toISOString());
  const put = (key: string, values: string[]) =>
    values.length && p.set(key, values.join(","));
  put("type", f.types);
  put("account", f.accounts);
  put("category", f.categories);
  put("tag", f.tags);
  put("excl_tag", f.exclTags);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.exclQ.trim()) p.set("excl_q", f.exclQ.trim());
  const min = f.min ? parseAmount(f.min) : null;
  const max = f.max ? parseAmount(f.max) : null;
  if (min !== null) p.set("min", String(min));
  if (max !== null) p.set("max", String(max));
  if (!f.groupShares) p.set("include_group_shares", "false");
  if (f.planned === "all") p.set("planned", "all");
  if (f.hideAdjustments) p.set("hide_adjustments", "true");
  return p;
}

export type ActiveFilter = { key: string; label: string };

/** Everything except the period and breakdown that differs from the default. */
export function activeFilters(
  f: ReportFilters,
  names: {
    accounts: Record<string, string>;
    categories: Record<string, string>;
    tags: Record<string, string>;
  },
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const typeLabel: Record<string, string> = {
    INCOME: "Income",
    EXPENSE: "Expenses",
    TRANSFER: "Transfers",
  };
  f.types.forEach((t) => out.push({ key: `type:${t}`, label: typeLabel[t] }));
  f.accounts.forEach((id) =>
    out.push({ key: `account:${id}`, label: names.accounts[id] ?? "Account" }),
  );
  f.categories.forEach((id) =>
    out.push({
      key: `category:${id}`,
      label:
        id === "none" ? "Uncategorized" : (names.categories[id] ?? "Category"),
    }),
  );
  f.tags.forEach((id) =>
    out.push({ key: `tag:${id}`, label: `#${names.tags[id] ?? "tag"}` }),
  );
  f.exclTags.forEach((id) =>
    out.push({
      key: `excl_tag:${id}`,
      label: `not #${names.tags[id] ?? "tag"}`,
    }),
  );
  if (f.q) out.push({ key: "q", label: `“${f.q}”` });
  if (f.exclQ) out.push({ key: "excl_q", label: `without “${f.exclQ}”` });
  if (f.min) out.push({ key: "min", label: `min ${f.min}` });
  if (f.max) out.push({ key: "max", label: `max ${f.max}` });
  if (!f.groupShares)
    out.push({ key: "groupShares", label: "No group shares" });
  if (f.planned === "all") out.push({ key: "planned", label: "Incl. planned" });
  if (f.hideAdjustments)
    out.push({ key: "hideAdjustments", label: "No adjustments" });
  return out;
}

/** Returns the filters with one active filter removed. */
export function removeFilter(f: ReportFilters, key: string): ReportFilters {
  const [kind, id] = key.split(":");
  switch (kind) {
    case "type":
      return { ...f, types: f.types.filter((t) => t !== id) };
    case "account":
      return { ...f, accounts: f.accounts.filter((a) => a !== id) };
    case "category":
      return { ...f, categories: f.categories.filter((c) => c !== id) };
    case "tag":
      return { ...f, tags: f.tags.filter((t) => t !== id) };
    case "excl_tag":
      return { ...f, exclTags: f.exclTags.filter((t) => t !== id) };
    case "q":
      return { ...f, q: "" };
    case "excl_q":
      return { ...f, exclQ: "" };
    case "min":
      return { ...f, min: "" };
    case "max":
      return { ...f, max: "" };
    case "groupShares":
      return { ...f, groupShares: true };
    case "planned":
      return { ...f, planned: "false" };
    case "hideAdjustments":
      return { ...f, hideAdjustments: false };
    default:
      return f;
  }
}

/** Clears every filter but keeps the period and breakdown. */
export const clearFilters = (f: ReportFilters): ReportFilters => ({
  ...DEFAULT_FILTERS,
  from: f.from,
  to: f.to,
  breakdown: f.breakdown,
  bucket: f.bucket,
});

// ----------------------------------------------------------------- breakdown

export type CategoryRow = {
  category_id: string | null;
  name: string;
  icon?: string;
  color?: string;
  amount: number;
  count: number;
  percent: number;
};

export type Slice = {
  key: string;
  name: string;
  amount: number;
  count: number;
  percent: number;
  /** 0-based chart colour slot (chart1..chart8). */
  slot: number;
  /** Category ids behind the slice ("none" = uncategorised). */
  ids: string[];
  other: boolean;
};

/** Largest-remainder rounding to one decimal so shares always sum to 100.0. */
export function roundPercents(amounts: number[]): number[] {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a / total) * 1000);
  const floors = raw.map(Math.floor);
  let left = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - floors[i] }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((n) => n / 10);
}

/** Top `keep` categories as slices plus one "Other" for the rest. */
export function groupSlices(rows: CategoryRow[], keep = 7): Slice[] {
  const sorted = [...rows]
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const toSlice = (r: CategoryRow, slot: number): Slice => ({
    key: r.category_id ?? "none",
    name: r.name,
    amount: r.amount,
    count: r.count,
    percent: r.percent,
    slot,
    ids: [r.category_id ?? "none"],
    other: false,
  });
  if (sorted.length <= keep + 1) return sorted.map((r, i) => toSlice(r, i));
  const head = sorted.slice(0, keep).map((r, i) => toSlice(r, i));
  const tail = sorted.slice(keep);
  const amount = tail.reduce((a, r) => a + r.amount, 0);
  const all = [...head.map((s) => s.amount), amount];
  const pct = roundPercents(all);
  return [
    ...head.map((s, i) => ({ ...s, percent: pct[i] })),
    {
      key: "other",
      name: "Other",
      amount,
      count: tail.reduce((a, r) => a + r.count, 0),
      percent: pct[keep],
      slot: keep,
      ids: tail.map((r) => r.category_id ?? "none"),
      other: true,
    },
  ];
}

// -------------------------------------------------------------------- donut

const TAU = Math.PI * 2;
const pt = (cx: number, cy: number, r: number, a: number) =>
  `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;

/** SVG path for a ring segment between two fractions (0..1) of the circle. */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): string {
  const span = Math.min(Math.max(end - start, 0), 1);
  if (span <= 0) return "";
  if (span >= 0.9999) {
    // A full ring needs two half arcs (a single 360-degree arc draws nothing).
    return [
      `M ${pt(cx, cy, outer, 0)}`,
      `A ${outer} ${outer} 0 1 1 ${pt(cx, cy, outer, Math.PI)}`,
      `A ${outer} ${outer} 0 1 1 ${pt(cx, cy, outer, 0)}`,
      `M ${pt(cx, cy, inner, 0)}`,
      `A ${inner} ${inner} 0 1 0 ${pt(cx, cy, inner, Math.PI)}`,
      `A ${inner} ${inner} 0 1 0 ${pt(cx, cy, inner, 0)}`,
      "Z",
    ].join(" ");
  }
  const a0 = start * TAU;
  const a1 = (start + span) * TAU;
  const large = span > 0.5 ? 1 : 0;
  return [
    `M ${pt(cx, cy, outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${pt(cx, cy, outer, a1)}`,
    `L ${pt(cx, cy, inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${pt(cx, cy, inner, a0)}`,
    "Z",
  ].join(" ");
}

/** Arc paths for slices by amount share. */
export function donutArcs(
  slices: Pick<Slice, "amount">[],
  size = 200,
  thickness = 34,
) {
  const total = slices.reduce((a, s) => a + s.amount, 0);
  const c = size / 2;
  let cursor = 0;
  return slices.map((s) => {
    const share = total > 0 ? s.amount / total : 0;
    const d = arcPath(c, c, c - 2, c - 2 - thickness, cursor, cursor + share);
    cursor += share;
    return d;
  });
}

/** Text for the chart's role=img label. */
export function donutSummary(
  title: string,
  slices: Pick<Slice, "name" | "percent">[],
): string {
  if (!slices.length) return `${title}: no data`;
  return `${title}: ${slices
    .map((s) => `${s.name} ${s.percent} percent`)
    .join(", ")}`;
}

// -------------------------------------------------------------------- trend

const DAY = 86_400_000;

/** Day buckets for short ranges, weeks for a few months, then months. */
export function chooseBucket(period: Pick<Period, "from" | "to">): Bucket {
  const days = Math.max(
    Math.round((period.to.getTime() - period.from.getTime()) / DAY),
    1,
  );
  if (days <= 45) return "day";
  if (days <= 210) return "week";
  return "month";
}

/** The next coarser bucket, used when the API says the range is too long. */
export const coarser = (b: Bucket): Bucket | null =>
  b === "day" ? "week" : b === "week" ? "month" : null;

export type TrendBucket = {
  start: string;
  end: string;
  income: number;
  expense: number;
  net: number;
};

/** A "nice" axis maximum and ticks (minor units) from one scale for all bars. */
export function niceScale(max: number, ticks = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const rough = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v));
  return { max: top, ticks: out };
}

/** Compact axis label from minor units: 1.2M, 45k, 800. */
export function compactAmount(minor: number): string {
  const v = Math.abs(minor) / 100;
  const sign = minor < 0 ? "−" : "";
  const fmt = (n: number, s: string) =>
    `${sign}${n >= 100 ? Math.round(n) : Math.round(n * 10) / 10}${s}`;
  if (v >= 1e9) return fmt(v / 1e9, "B");
  if (v >= 1e6) return fmt(v / 1e6, "M");
  if (v >= 1e3) return fmt(v / 1e3, "k");
  return `${sign}${Math.round(v)}`;
}

export type BarGeometry = {
  x: number;
  width: number;
  incomeY: number;
  incomeH: number;
  expenseY: number;
  expenseH: number;
  netY: number;
  cx: number;
};

/**
 * Bar and net-line positions for a plot area (top-left origin). One scale
 * serves bars and line; the domain reaches below zero when net is negative.
 */
export function barLayout(
  buckets: TrendBucket[],
  width: number,
  height: number,
) {
  const hiRaw = Math.max(
    0,
    ...buckets.flatMap((b) => [b.income, b.expense, b.net]),
  );
  const loRaw = Math.min(0, ...buckets.map((b) => b.net));
  const base = niceScale(Math.max(hiRaw, -loRaw));
  const step = base.ticks.length > 1 ? base.ticks[1] : base.max;
  const top = Math.max(Math.ceil(hiRaw / step) * step, step);
  const bottom = loRaw < 0 ? -Math.ceil(-loRaw / step) * step : 0;
  const ticks: number[] = [];
  for (let v = bottom; v <= top; v += step) ticks.push(v);
  const range = top - bottom;
  const y = (v: number) => ((top - v) / range) * height;
  const zero = y(0);
  const slot = buckets.length ? width / buckets.length : width;
  const barW = Math.max(Math.min(slot * 0.34, 28), 2);
  const bars: BarGeometry[] = buckets.map((b, i) => {
    const cx = i * slot + slot / 2;
    return {
      cx,
      x: cx - barW - 1,
      width: barW,
      incomeY: y(b.income),
      incomeH: zero - y(b.income),
      expenseY: y(b.expense),
      expenseH: zero - y(b.expense),
      netY: y(b.net),
    };
  });
  return { ticks, top, bottom, bars, slot, barW, y, zero };
}

/** Axis label for a bucket start in the viewer's locale. */
export function bucketLabel(
  start: string,
  bucket: Bucket,
  locale?: string,
): string {
  const d = new Date(start);
  if (bucket === "month")
    return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// ------------------------------------------------------------------ presets

export type PresetKey = "3m" | "6m" | "ytd" | "12m";
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "ytd", label: "This year" },
  { key: "12m", label: "12 months" },
];

/** Ranges that end with the current budgeting period (or the calendar year). */
export function presetPeriod(
  key: PresetKey,
  startDay: number,
  now = new Date(),
): Period {
  const current = periodContaining(now, startDay);
  if (key === "ytd")
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear() + 1, 0, 1),
      custom: true,
    };
  const back = key === "3m" ? 2 : key === "6m" ? 5 : 11;
  return {
    from: shiftPeriod(current, -back, startDay).from,
    to: current.to,
    custom: true,
  };
}
