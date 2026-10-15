import { describe, expect, it } from "vitest";
import {
  applyPlannedResult,
  budgetProgress,
  buildBudgetQuery,
  buildLoanQuery,
  buildPlannedQuery,
  buildSkipOverdueQuery,
  cadenceLabel,
  daysLeft,
  dueLabel,
  isOverdue,
  loanProgress,
  PlannedItem,
  PlannedPayment,
  plannedNet,
  planStatus,
  scheduleFields,
  splitPlans,
} from "../lib/planning";

const item = (id: string, due: string, extra: Partial<PlannedItem> = {}) =>
  ({
    id,
    type: "EXPENSE",
    account_id: null,
    to_account_id: null,
    amount: 1000,
    currency: "NPR",
    to_amount: null,
    category_id: null,
    title: id,
    description: "",
    occurred_at: null,
    due_at: due,
    source: "MANUAL",
    ...extra,
  }) as PlannedItem;

describe("cadence labels", () => {
  it.each([
    [null, "One-time"],
    [{ one_time: true, interval_n: null, interval_unit: null }, "One-time"],
    [{ one_time: false, interval_n: 1, interval_unit: "MONTH" }, "Monthly"],
    [{ one_time: false, interval_n: 1, interval_unit: "DAY" }, "Daily"],
    [{ one_time: false, interval_n: 1, interval_unit: "WEEK" }, "Weekly"],
    [{ one_time: false, interval_n: 1, interval_unit: "YEAR" }, "Yearly"],
    [
      { one_time: false, interval_n: 2, interval_unit: "WEEK" },
      "Every 2 weeks",
    ],
    [
      { one_time: false, interval_n: 3, interval_unit: "MONTH" },
      "Every 3 months",
    ],
    [{ one_time: false, interval_n: null, interval_unit: "YEAR" }, "Yearly"],
    [{ one_time: false, interval_n: 1, interval_unit: null }, "One-time"],
  ] as const)("%j → %s", (plan, label) => {
    expect(cadenceLabel(plan)).toBe(label);
  });
});

describe("due labels", () => {
  const now = new Date(2026, 9, 14, 12, 0);
  it("counts overdue days", () => {
    expect(dueLabel(new Date(2026, 9, 12, 9).toISOString(), now)).toBe(
      "Overdue · 2 days",
    );
    expect(dueLabel(new Date(2026, 9, 13, 9).toISOString(), now)).toBe(
      "Overdue · 1 day",
    );
    expect(dueLabel(new Date(2026, 9, 14, 9).toISOString(), now)).toBe(
      "Overdue · today",
    );
  });
  it("describes upcoming dates", () => {
    expect(dueLabel(new Date(2026, 9, 14, 18).toISOString(), now)).toBe(
      "Due today",
    );
    expect(dueLabel(new Date(2026, 9, 15, 0).toISOString(), now)).toBe(
      "Due tomorrow",
    );
    expect(dueLabel(new Date(2026, 9, 19).toISOString(), now)).toBe(
      "Due in 5 days",
    );
    expect(dueLabel(new Date(2026, 10, 18).toISOString(), now, "en-GB")).toBe(
      "Due 18 Nov",
    );
    expect(dueLabel(null, now)).toBe("No due date");
  });
  it("flags overdue instants", () => {
    expect(isOverdue("2026-10-01T00:00:00Z", now)).toBe(true);
    expect(isOverdue("2027-01-01T00:00:00Z", now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});

describe("pay / skip state", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const to = new Date("2026-11-01T00:00:00Z");
  const plan = {
    id: "p",
    title: "Rent",
    one_time: false,
    interval_n: 1,
    interval_unit: "WEEK" as const,
    start_at: "2026-09-01T00:00:00Z",
    active: true,
  };
  const lists = {
    overdue: [item("a", "2026-10-07T00:00:00Z", { plan })],
    upcoming: [item("b", "2026-10-20T00:00:00Z")],
  };

  it("removes a paid standalone item", () => {
    const next = applyPlannedResult(lists, "b", null, now, to);
    expect(next.upcoming).toEqual([]);
    expect(next.overdue.map((i) => i.id)).toEqual(["a"]);
  });

  it("moves the next occurrence into upcoming and keeps the plan summary", () => {
    const next = applyPlannedResult(
      lists,
      "a",
      item("a2", "2026-10-21T00:00:00Z"),
      now,
      to,
    );
    expect(next.overdue).toEqual([]);
    expect(next.upcoming.map((i) => i.id)).toEqual(["b", "a2"]);
    expect(next.upcoming[1].plan?.title).toBe("Rent");
  });

  it("keeps a still-overdue next occurrence in overdue", () => {
    const next = applyPlannedResult(
      lists,
      "a",
      item("a2", "2026-10-13T00:00:00Z"),
      now,
      to,
    );
    expect(next.overdue.map((i) => i.id)).toEqual(["a2"]);
  });

  it("drops a next occurrence beyond the period", () => {
    const next = applyPlannedResult(
      lists,
      "a",
      item("a2", "2026-12-01T00:00:00Z"),
      now,
      to,
    );
    expect(next.upcoming.map((i) => i.id)).toEqual(["b"]);
    expect(next.overdue).toEqual([]);
  });

  it("nets income against expenses", () => {
    expect(
      plannedNet([
        item("x", "2026-10-20T00:00:00Z", { type: "INCOME", amount: 5000 }),
        item("y", "2026-10-20T00:00:00Z", { amount: 2000 }),
        item("z", "2026-10-20T00:00:00Z", { type: "TRANSFER", amount: 900 }),
      ]),
    ).toBe(3000);
  });
});

describe("plans", () => {
  const plan = (id: string, extra: Partial<PlannedPayment>) =>
    ({
      id,
      type: "EXPENSE",
      account_id: null,
      to_account_id: null,
      amount: 100,
      currency: "NPR",
      to_amount: null,
      category_id: null,
      title: id,
      description: "",
      start_at: "2026-10-01T00:00:00Z",
      one_time: false,
      interval_n: 1,
      interval_unit: "MONTH",
      active: true,
      next: null,
      next_due_at: null,
      ...extra,
    }) as PlannedPayment;

  it("splits recurring and one-time, active first by next due", () => {
    const { recurring, oneTime } = splitPlans([
      plan("late", { next_due_at: "2026-11-05T00:00:00Z" }),
      plan("paused", { active: false }),
      plan("soon", { next_due_at: "2026-10-20T00:00:00Z" }),
      plan("trip", { one_time: true, interval_n: null, interval_unit: null }),
    ]);
    expect(recurring.map((p) => p.id)).toEqual(["soon", "late", "paused"]);
    expect(oneTime.map((p) => p.id)).toEqual(["trip"]);
  });

  it("describes plan status", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(planStatus(plan("a", { active: false }), now)).toBe("Paused");
    expect(planStatus(plan("b", { active: false, one_time: true }), now)).toBe(
      "Done",
    );
    expect(planStatus(plan("c", {}), now)).toBe("No upcoming payment");
  });

  it("validates the schedule", () => {
    expect(
      scheduleFields({
        oneTime: true,
        n: "",
        unit: "MONTH",
        start: "2026-10-01",
      }),
    ).toEqual({ ok: true, value: { start_at: "2026-10-01", one_time: true } });
    expect(
      scheduleFields({
        oneTime: false,
        n: "2",
        unit: "WEEK",
        start: "2026-10-01",
      }),
    ).toEqual({
      ok: true,
      value: {
        start_at: "2026-10-01",
        one_time: false,
        interval_n: 2,
        interval_unit: "WEEK",
      },
    });
    expect(
      scheduleFields({
        oneTime: false,
        n: "0",
        unit: "WEEK",
        start: "2026-10-01",
      }).ok,
    ).toBe(false);
    expect(
      scheduleFields({
        oneTime: false,
        n: "1.5",
        unit: "DAY",
        start: "2026-10-01",
      }).ok,
    ).toBe(false);
    expect(
      scheduleFields({ oneTime: true, n: "1", unit: "DAY", start: "" }).ok,
    ).toBe(false);
  });
});

describe("budget progress", () => {
  it("is ok under 80%", () => {
    expect(budgetProgress({ amount: 10000, spent: 7480 })).toEqual({
      width: 75,
      percent: 75,
      state: "ok",
      over: false,
      left: 2520,
    });
  });
  it("is near at 80% and above", () => {
    expect(budgetProgress({ amount: 10000, spent: 8000 }).state).toBe("near");
    expect(budgetProgress({ amount: 10000, spent: 10000 }).state).toBe("near");
  });
  it("is over past the limit and caps the bar", () => {
    expect(budgetProgress({ amount: 5000, spent: 6100 })).toEqual({
      width: 100,
      percent: 122,
      state: "over",
      over: true,
      left: 1100,
    });
  });
  it("handles nothing spent", () => {
    expect(budgetProgress({ amount: 5000, spent: 0 }).width).toBe(0);
  });
  it("counts days left in the period", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(daysLeft(new Date("2026-11-01T00:00:00Z"), now)).toBe(18);
    expect(daysLeft(new Date("2026-10-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("loan progress", () => {
  it("measures what was paid back", () => {
    expect(
      loanProgress({ total: 50000, paid: 20000, paid_off: false }),
    ).toEqual({ width: 40, percent: 40 });
  });
  it("fills when paid off", () => {
    expect(loanProgress({ total: 100, paid: 120, paid_off: true }).width).toBe(
      100,
    );
  });
  it("handles an empty loan", () => {
    expect(loanProgress({ total: 0, paid: 0, paid_off: false }).width).toBe(0);
  });
});

describe("query building", () => {
  it("budgets carry the period as instants", () => {
    const q = buildBudgetQuery({
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-11-01T00:00:00Z"),
    });
    expect(q).toBe(
      "?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z",
    );
  });
  it("loans filter by type and paid off", () => {
    expect(buildLoanQuery({})).toBe("");
    expect(buildLoanQuery({ type: "LEND" })).toBe("?type=LEND");
    expect(buildLoanQuery({ type: "BORROW", includePaidOff: true })).toBe(
      "?type=BORROW&include_paid_off=true",
    );
  });
  it("skip-overdue scopes by account and category", () => {
    expect(buildSkipOverdueQuery({})).toBe("");
    expect(buildSkipOverdueQuery({ accounts: ["a", "a", ""] })).toBe(
      "?account=a",
    );
    expect(
      buildSkipOverdueQuery({ accounts: ["a", "b"], categories: ["c"] }),
    ).toBe("?account=a%2Cb&category=c");
  });
  it("planned filters by type and active", () => {
    expect(buildPlannedQuery({})).toBe("");
    expect(buildPlannedQuery({ active: false })).toBe("?active=false");
    expect(buildPlannedQuery({ type: "INCOME", active: true })).toBe(
      "?type=INCOME&active=true",
    );
  });
});
