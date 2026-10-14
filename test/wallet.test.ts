import { describe, expect, it } from "vitest";
import {
  buildLedgerQuery,
  colourCss,
  convertMinor,
  customPeriod,
  entryDirection,
  evaluateExpression,
  formatMoney,
  isExpression,
  minorToInput,
  moveItem,
  parseAmount,
  PALETTE,
  periodContaining,
  periodLabel,
  periodParams,
  resolveRate,
  shiftPeriod,
  toMinor,
  transferToAmount,
} from "../lib/wallet";

describe("expression evaluator", () => {
  it.each([
    ["1200", 1200],
    ["1200*4", 4800],
    ["1,200 × 4", 4800],
    ["10+5*2", 20],
    ["(10+5)*2", 30],
    ["100/8", 12.5],
    ["-5+10", 5],
    ["2*-3", -6],
    ["12.5 + .5", 13],
    ["7 ÷ 2", 3.5],
    ["10 − 4", 6],
    ["3x3", 9],
    ["12.", 12],
  ])("%s = %s", (input, expected) => {
    expect(evaluateExpression(input)).toBeCloseTo(expected, 10);
  });

  it.each(["", "abc", "1+", "(1+2", "1/0", "1..2", "2**3", "1+2)", "1e5"])(
    "rejects %j",
    (input) => {
      expect(evaluateExpression(input)).toBeNull();
    },
  );

  it("detects when a live result is worth showing", () => {
    expect(isExpression("1200")).toBe(false);
    expect(isExpression("1,200.50")).toBe(false);
    expect(isExpression("1200*4")).toBe(true);
    expect(isExpression("(3)")).toBe(true);
    expect(isExpression("5 - 2")).toBe(true);
  });

  it("parses amounts to positive minor units", () => {
    expect(parseAmount("1200*4")).toBe(480000);
    expect(parseAmount("0.1+0.2")).toBe(30);
    expect(parseAmount("10.005")).toBe(1001);
    expect(parseAmount("5-5")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("x")).toBeNull();
  });

  it("converts between major and minor units", () => {
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(1.005)).toBe(101);
    expect(minorToInput(123450)).toBe("1234.5");
    expect(minorToInput(5)).toBe("0.05");
  });
});

describe("period logic with month_start_day", () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

  it("calendar months when the month starts on the 1st", () => {
    const p = periodContaining(d(2026, 10, 13), 1);
    expect(p.from).toEqual(d(2026, 10, 1));
    expect(p.to).toEqual(d(2026, 11, 1));
    expect(periodLabel(p, "en-GB")).toBe("October 2026");
  });

  it("uses the previous month's start day before it is reached", () => {
    const p = periodContaining(d(2026, 10, 10), 25);
    expect(p.from).toEqual(d(2026, 9, 25));
    expect(p.to).toEqual(d(2026, 10, 25));
    expect(periodLabel(p, "en-GB")).toBe("25 Sept – 24 Oct 2026");
  });

  it("includes the start day itself", () => {
    const p = periodContaining(new Date(2026, 9, 25, 0, 0, 1), 25);
    expect(p.from).toEqual(d(2026, 10, 25));
  });

  it("crosses year boundaries in both directions", () => {
    const p = periodContaining(d(2026, 1, 5), 15);
    expect(p.from).toEqual(d(2025, 12, 15));
    const next = shiftPeriod(p, 1, 15);
    expect(next.from).toEqual(d(2026, 1, 15));
    expect(next.to).toEqual(d(2026, 2, 15));
    const prev = shiftPeriod(p, -1, 15);
    expect(prev.from).toEqual(d(2025, 11, 15));
    expect(periodLabel(p, "en-GB")).toBe("15 Dec 2025 – 14 Jan 2026");
  });

  it("clamps invalid start days to 1–28", () => {
    expect(periodContaining(d(2026, 2, 27), 31).from).toEqual(d(2026, 1, 28));
    expect(periodContaining(d(2026, 2, 27), 0).from).toEqual(d(2026, 2, 1));
  });

  it("builds inclusive custom ranges and shifts them by their length", () => {
    const p = customPeriod("2026-10-01", "2026-10-07")!;
    expect(p.from).toEqual(d(2026, 10, 1));
    expect(p.to).toEqual(d(2026, 10, 8));
    expect(periodLabel(p, "en-GB")).toBe("1 Oct – 7 Oct 2026");
    const next = shiftPeriod(p, 1);
    expect(next.from).toEqual(d(2026, 10, 8));
    expect(next.to).toEqual(d(2026, 10, 15));
    expect(next.custom).toBe(true);
    expect(customPeriod("2026-10-07", "2026-10-01")).toBeNull();
    expect(customPeriod("nope", "2026-10-01")).toBeNull();
  });

  it("labels a single custom day plainly", () => {
    expect(
      periodLabel(customPeriod("2026-10-03", "2026-10-03")!, "en-GB"),
    ).toBe("3 Oct 2026");
  });

  it("serialises periods as RFC 3339 instants", () => {
    const params = periodParams(periodContaining(d(2026, 10, 13), 1));
    expect(new Date(params.from).getTime()).toBe(d(2026, 10, 1).getTime());
    expect(new Date(params.to).getTime()).toBe(d(2026, 11, 1).getTime());
  });
});

describe("money formatting", () => {
  it("always shows the currency code and two decimals", () => {
    expect(formatMoney(123456, "USD")).toMatch(/USD\s?1,234\.56/);
    expect(formatMoney(5, "NPR")).toMatch(/NPR\s?0\.05/);
  });

  it("signs explicitly with a real minus sign", () => {
    expect(formatMoney(-2500, "EUR")).toMatch(/^− EUR\s?25\.00$/);
    expect(formatMoney(2500, "EUR", { sign: "+" })).toMatch(/^\+ EUR/);
    expect(formatMoney(2500, "EUR", { sign: "-" })).toMatch(/^− EUR/);
    expect(formatMoney(2500, "EUR", { sign: "always" })).toMatch(/^\+ /);
    expect(formatMoney(0, "EUR", { sign: "always" })).toMatch(/^EUR/);
  });

  it("masks hidden balances but keeps the currency", () => {
    expect(formatMoney(999, "NPR", { hidden: true })).toBe("NPR •••••");
  });

  it("falls back for unknown currency codes", () => {
    expect(formatMoney(150, "ZZZZ")).toBe("ZZZZ 1.50");
  });
});

describe("transfer amount logic", () => {
  const overrides = [{ base: "USD", quote: "NPR", rate: 135 }];
  const fetched = { base: "NPR", rates: { EUR: 0.0064, USD: 0.0075 } };

  it("prefers the user's override in either direction", () => {
    expect(resolveRate("USD", "NPR", overrides, fetched)).toEqual({
      rate: 135,
      source: "override",
    });
    expect(resolveRate("NPR", "USD", overrides, fetched)?.rate).toBeCloseTo(
      1 / 135,
    );
  });

  it("falls back to fetched rates from either base", () => {
    expect(resolveRate("NPR", "EUR", [], fetched)).toEqual({
      rate: 0.0064,
      source: "fetched",
    });
    expect(resolveRate("EUR", "NPR", [], fetched)?.rate).toBeCloseTo(156.25);
    expect(resolveRate("GBP", "JPY", [], fetched)).toBeNull();
    expect(resolveRate("NPR", "NPR")).toEqual({ rate: 1, source: "same" });
  });

  it("omits to_amount for same-currency transfers", () => {
    expect(
      transferToAmount({
        amount: 1000,
        fromCurrency: "NPR",
        toCurrency: "NPR",
      }),
    ).toBeNull();
  });

  it("converts with the rate unless the user typed the received amount", () => {
    expect(
      transferToAmount({
        amount: 10000,
        fromCurrency: "USD",
        toCurrency: "NPR",
        rate: 135,
      }),
    ).toBe(1350000);
    expect(
      transferToAmount({
        amount: 10000,
        fromCurrency: "USD",
        toCurrency: "NPR",
        rate: 135,
        manual: 1340000,
      }),
    ).toBe(1340000);
    expect(
      transferToAmount({
        amount: 10000,
        fromCurrency: "USD",
        toCurrency: "NPR",
      }),
    ).toBeNull();
    expect(convertMinor(333, 0.5)).toBe(167);
  });
});

describe("ledger query building", () => {
  it("omits empty filters", () => {
    expect(buildLedgerQuery({})).toBe("");
    expect(buildLedgerQuery({ q: "  ", types: [], accounts: [""] })).toBe("");
  });

  it("joins lists with commas, dedupes and trims the search", () => {
    const query = buildLedgerQuery({
      q: " dinner ",
      types: ["EXPENSE", "INCOME", "EXPENSE"],
      accounts: ["a1", "a2"],
      categories: ["c1"],
      tags: ["t1"],
      limit: 25,
      cursor: "abc=",
    });
    const params = new URLSearchParams(query.slice(1));
    expect(params.get("q")).toBe("dinner");
    expect(params.get("type")).toBe("EXPENSE,INCOME");
    expect(params.get("account")).toBe("a1,a2");
    expect(params.get("category")).toBe("c1");
    expect(params.get("tag")).toBe("t1");
    expect(params.get("limit")).toBe("25");
    expect(params.get("cursor")).toBe("abc=");
  });

  it("adds the period as from/to instants", () => {
    const period = periodContaining(new Date(2026, 9, 13), 1);
    const params = new URLSearchParams(buildLedgerQuery({ period }).slice(1));
    expect(params.get("from")).toBe(period.from.toISOString());
    expect(params.get("to")).toBe(period.to.toISOString());
  });
});

describe("ledger helpers", () => {
  it("derives row direction", () => {
    const base = { kind: "TRANSACTION" as const, account_amount: null };
    expect(entryDirection({ ...base, type: "INCOME" })).toBe("in");
    expect(entryDirection({ ...base, type: "EXPENSE" })).toBe("out");
    expect(entryDirection({ ...base, type: "TRANSFER" })).toBe("neutral");
    expect(entryDirection({ ...base, type: "TRANSFER" }, "a", "a")).toBe("out");
    expect(entryDirection({ ...base, type: "TRANSFER" }, "b", "a")).toBe("in");
    expect(
      entryDirection({ ...base, type: "SETTLEMENT", account_amount: -5 }),
    ).toBe("out");
    expect(
      entryDirection({ ...base, type: "SETTLEMENT", account_amount: 5 }),
    ).toBe("in");
  });

  it("moves items for keyboard reordering", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, -2)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });

  it("maps palette colours to theme tokens and keeps data colours", () => {
    expect(PALETTE).toHaveLength(8);
    expect(colourCss(PALETTE[2].stored)).toBe("var(--st-chart3)");
    expect(colourCss(PALETTE[2].stored.toLowerCase())).toBe("var(--st-chart3)");
    expect(colourCss("chart5")).toBe("var(--st-chart5)");
    expect(colourCss(undefined)).toBe("var(--st-chart1)");
    expect(colourCss("url(x)")).toBe("var(--st-chart1)");
  });
});
