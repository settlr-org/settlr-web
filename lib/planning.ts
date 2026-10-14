// Wallet planning (planned payments, budgets, loans) — types and pure helpers.
// Framework-free so everything here can be unit tested in isolation.
import type { Period, TagRef, Transaction, TxnType } from "./wallet";
import { periodParams } from "./wallet";

export type IntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type Cadence = {
  one_time: boolean;
  interval_n: number | null;
  interval_unit: IntervalUnit | null;
};

/** Summary of the plan a planned item belongs to. */
export type PlanRef = Cadence & {
  id: string;
  title: string;
  start_at: string;
  active: boolean;
};

/** An unpaid planned transaction; `plan` is null for standalone items. */
export type PlannedItem = Transaction & {
  planned?: boolean;
  planned_payment_id?: string | null;
  plan?: PlanRef | null;
};

export type PlannedPayment = Cadence & {
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
  start_at: string;
  active: boolean;
  tags?: TagRef[];
  next: PlannedItem | null;
  next_due_at: string | null;
};

export type PayResult = { transaction?: Transaction; next: PlannedItem | null };

export type Budget = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category_ids: string[];
  account_ids: string[];
  sort_order: number;
  from: string;
  to: string;
  spent: number;
  remaining: number;
  percent: number;
  missing_rates?: string[];
};

export type BudgetList = {
  data: Budget[];
  from: string;
  to: string;
  currency: string;
  total_amount: number;
  total_spent: number;
  total_remaining: number;
  missing_rates?: string[];
};

export type LoanType = "LEND" | "BORROW";

export type Loan = {
  id: string;
  name: string;
  type: LoanType;
  amount: number;
  currency: string;
  color: string;
  icon: string;
  note: string;
  account_id: string | null;
  transaction_id: string | null;
  occurred_at: string;
  sort_order: number;
  total: number;
  paid: number;
  remaining: number;
  percent: number;
  paid_off: boolean;
  records_count: number;
};

export type LoanList = {
  data: Loan[];
  currency: string;
  lend_remaining: number;
  borrow_remaining: number;
  missing_rates?: string[];
};

export type LoanRecordType = "INCREASE" | "DECREASE";

export type LoanRecord = {
  id: string;
  loan_id: string;
  type: LoanRecordType;
  amount: number;
  note: string;
  occurred_at: string;
  account_id: string | null;
  transaction_id: string | null;
};

// ---------------------------------------------------------------- cadence

const UNIT_WORDS: Record<IntervalUnit, [string, string, string]> = {
  // [adverb for n = 1, singular, plural]
  DAY: ["Daily", "day", "days"],
  WEEK: ["Weekly", "week", "weeks"],
  MONTH: ["Monthly", "month", "months"],
  YEAR: ["Yearly", "year", "years"],
};

export const INTERVAL_UNITS: { value: IntervalUnit; label: string }[] = [
  { value: "DAY", label: "days" },
  { value: "WEEK", label: "weeks" },
  { value: "MONTH", label: "months" },
  { value: "YEAR", label: "years" },
];

/** "One-time", "Monthly", "Every 2 weeks"; standalone planned items (no plan) are one-time. */
export function cadenceLabel(plan?: Partial<Cadence> | null): string {
  if (!plan || plan.one_time || !plan.interval_unit) return "One-time";
  const words = UNIT_WORDS[plan.interval_unit];
  if (!words) return "One-time";
  const n = Math.max(1, Math.trunc(plan.interval_n ?? 1));
  return n === 1 ? words[0] : `Every ${n} ${words[2]}`;
}

// ---------------------------------------------------------------- due dates

const DAY_MS = 86_400_000;
const localDay = (d: Date) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;

/** Whole calendar days from `now` to `due` (negative when overdue), in local time. */
export const daysUntil = (due: Date, now: Date) =>
  localDay(due) - localDay(now);

/** True when the item was due before `now`. */
export const isOverdue = (dueAt: string | null | undefined, now: Date) =>
  Boolean(dueAt) && new Date(dueAt!).getTime() < now.getTime();

/** "Overdue · 2 days", "Due today", "Due tomorrow", "Due in 5 days", "Due 18 Nov". */
export function dueLabel(
  dueAt: string | null | undefined,
  now: Date,
  locale?: string,
): string {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  const days = daysUntil(due, now);
  if (due.getTime() < now.getTime()) {
    const late = Math.max(0, -days);
    return late === 0
      ? "Overdue · today"
      : `Overdue · ${late} ${late === 1 ? "day" : "days"}`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 6) return `Due in ${days} days`;
  return `Due ${due.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(due.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })}`;
}

// ---------------------------------------------------------------- pay / skip state

export type PlannedLists = { upcoming: PlannedItem[]; overdue: PlannedItem[] };

const byDue = (a: PlannedItem, b: PlannedItem) =>
  new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime();

/**
 * Lists after paying or skipping `id`: the item leaves both lists and the
 * plan's next occurrence (if any) joins overdue when already due, upcoming
 * when due before `to` (end of the shown period), and neither otherwise.
 * The plan summary of the old item is carried over to the next one.
 */
export function applyPlannedResult(
  lists: PlannedLists,
  id: string,
  next: PlannedItem | null | undefined,
  now: Date,
  to?: Date,
): PlannedLists {
  const old = [...lists.overdue, ...lists.upcoming].find((i) => i.id === id);
  const upcoming = lists.upcoming.filter((i) => i.id !== id);
  const overdue = lists.overdue.filter((i) => i.id !== id);
  if (next?.due_at) {
    const item: PlannedItem = { ...next, plan: next.plan ?? old?.plan ?? null };
    const due = new Date(next.due_at).getTime();
    if (due < now.getTime()) overdue.push(item);
    else if (!to || due < to.getTime()) upcoming.push(item);
  }
  return { upcoming: upcoming.sort(byDue), overdue: overdue.sort(byDue) };
}

/** Signed sum (in/out) of planned items in one currency, for a short total. */
export function plannedNet(items: PlannedItem[]): number {
  return items.reduce(
    (sum, i) =>
      sum +
      (i.type === "INCOME" ? i.amount : i.type === "EXPENSE" ? -i.amount : 0),
    0,
  );
}

/** Recurring vs one-time plans, each by next due date (inactive plans last). */
export function splitPlans(plans: PlannedPayment[]) {
  const order = (a: PlannedPayment, b: PlannedPayment) =>
    Number(!a.active) - Number(!b.active) ||
    new Date(a.next_due_at ?? a.start_at).getTime() -
      new Date(b.next_due_at ?? b.start_at).getTime() ||
    a.title.localeCompare(b.title);
  return {
    recurring: plans.filter((p) => !p.one_time).sort(order),
    oneTime: plans.filter((p) => p.one_time).sort(order),
  };
}

/** Status line for a plan: paused, done (one-time paid/skipped) or next due. */
export function planStatus(plan: PlannedPayment, now: Date): string {
  if (!plan.active) return plan.one_time && !plan.next ? "Done" : "Paused";
  if (!plan.next_due_at) return "No upcoming payment";
  return dueLabel(plan.next_due_at, now);
}

// ---------------------------------------------------------------- budgets

export type BudgetState = "ok" | "near" | "over";

/** Bar width (0–100), state and the remaining/over amount for a budget. */
export function budgetProgress(b: Pick<Budget, "amount" | "spent">) {
  const ratio = b.amount > 0 ? b.spent / b.amount : b.spent > 0 ? Infinity : 0;
  const over = b.spent > b.amount;
  const state: BudgetState = over ? "over" : ratio >= 0.8 ? "near" : "ok";
  const width = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return {
    width: Number.isFinite(width) ? width : 100,
    percent: Number.isFinite(ratio) ? Math.round(ratio * 100) : 100,
    state,
    over,
    left: Math.abs(b.amount - b.spent),
  };
}

/** Whole days left in a period (counting today), 0 once it has ended. */
export function daysLeft(to: Date, now: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - now.getTime()) / DAY_MS));
}

/** Query for GET /budgets for a period. */
export function buildBudgetQuery(period: Period): string {
  return `?${new URLSearchParams(periodParams(period)).toString()}`;
}

// ---------------------------------------------------------------- loans

/** Bar width (0–100) of what has been paid back. */
export function loanProgress(l: Pick<Loan, "total" | "paid" | "paid_off">) {
  const ratio = l.total > 0 ? l.paid / l.total : 0;
  return {
    width: l.paid_off
      ? 100
      : Math.max(0, Math.min(100, Math.round(ratio * 100))),
    percent: Math.round(ratio * 100),
  };
}

/** Query for GET /loans. */
export function buildLoanQuery(options: {
  type?: LoanType;
  includePaidOff?: boolean;
}): string {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.includePaidOff) params.set("include_paid_off", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Query for POST /transactions/skip-overdue, optionally limited to accounts / categories. */
export function buildSkipOverdueQuery(scope: {
  accounts?: string[];
  categories?: string[];
}): string {
  const params = new URLSearchParams();
  const list = (key: string, values?: string[]) => {
    const clean = Array.from(new Set((values ?? []).filter(Boolean)));
    if (clean.length) params.set(key, clean.join(","));
  };
  list("account", scope.accounts);
  list("category", scope.categories);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Query for GET /planned. */
export function buildPlannedQuery(options: {
  type?: TxnType;
  active?: boolean;
}): string {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.active !== undefined)
    params.set("active", String(options.active));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** "Lent" / "Borrowed" wording for a loan and its records from the user's side. */
export const loanWords = (type: LoanType) =>
  type === "LEND"
    ? {
        kind: "Lent",
        paid: "back",
        left: "to collect",
        remaining: "Still to collect",
        increase: "Lent more",
        decrease: "Got paid back",
      }
    : {
        kind: "Borrowed",
        paid: "repaid",
        left: "left to repay",
        remaining: "Left to repay",
        increase: "Borrowed more",
        decrease: "Paid back",
      };

/** YYYY-MM-DD (UTC) of an ISO instant: the calendar date plans are anchored on. */
export const utcDateInput = (iso: string) => iso.slice(0, 10);

/**
 * Validates the schedule part of a plan form and returns the API fields, or
 * an error message. `n` is the raw "every N" text.
 */
export function scheduleFields(input: {
  oneTime: boolean;
  n: string;
  unit: IntervalUnit;
  start: string;
}):
  { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start))
    return { ok: false, error: "Choose a start date." };
  if (input.oneTime)
    return { ok: true, value: { start_at: input.start, one_time: true } };
  const n = Number(input.n);
  if (!Number.isInteger(n) || n < 1 || n > 1000)
    return {
      ok: false,
      error: "Repeat every 1 to 1000 days, weeks, months or years.",
    };
  return {
    ok: true,
    value: {
      start_at: input.start,
      one_time: false,
      interval_n: n,
      interval_unit: input.unit,
    },
  };
}
