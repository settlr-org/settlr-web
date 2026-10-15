import { describe, expect, it } from "vitest";
import {
  activeFilters,
  apiFilterParams,
  arcPath,
  barLayout,
  chooseBucket,
  clearFilters,
  coarser,
  compactAmount,
  DEFAULT_FILTERS,
  donutArcs,
  donutSummary,
  filtersPeriod,
  groupSlices,
  niceScale,
  parseFilters,
  periodDates,
  presetPeriod,
  removeFilter,
  roundPercents,
  serializeFilters,
  type CategoryRow,
} from "../lib/reports";

const q = (s: string) => new URLSearchParams(s);

describe("filters <-> query string", () => {
  it("round-trips every filter", () => {
    const f = {
      ...DEFAULT_FILTERS,
      from: "2026-10-01",
      to: "2026-10-31",
      types: ["EXPENSE", "TRANSFER"] as const,
      accounts: ["a1", "a2"],
      categories: ["c1", "none"],
      tags: ["t1"],
      exclTags: ["t2"],
      q: "rent march",
      exclQ: "refund",
      min: "10",
      max: "250.50",
      groupShares: false,
      planned: "all" as const,
      hideAdjustments: true,
      breakdown: "income" as const,
      bucket: "week" as const,
    };
    const again = parseFilters(serializeFilters({ ...f, types: [...f.types] }));
    expect(again).toEqual({ ...f, types: [...f.types] });
  });
  it("omits defaults so URLs stay short", () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
    expect(parseFilters(q(""))).toEqual(DEFAULT_FILTERS);
  });
  it("drops invalid input instead of trusting it", () => {
    const f = parseFilters(
      q(
        "from=2026-02-30&to=2026-03-01&type=EXPENSE,HACK&account=ok,bad id,<x>&min=abc&max=-5&bucket=year&planned=maybe&breakdown=zzz",
      ),
    );
    expect(f.from).toBeUndefined();
    expect(f.types).toEqual(["EXPENSE"]);
    expect(f.accounts).toEqual(["ok"]);
    expect(f.min).toBe("");
    expect(f.max).toBe("");
    expect(f.bucket).toBeUndefined();
    expect(f.planned).toBe("false");
    expect(f.breakdown).toBe("expense");
  });
  it("rejects a reversed range and min above max", () => {
    expect(
      parseFilters(q("from=2026-10-31&to=2026-10-01")).from,
    ).toBeUndefined();
    const f = parseFilters(q("min=50&max=10"));
    expect(f.min).toBe("50");
    expect(f.max).toBe("");
  });
  it("caps free text length", () => {
    expect(parseFilters(q("q=" + "x".repeat(500))).q).toHaveLength(200);
  });
  it("de-duplicates ids", () => {
    expect(parseFilters(q("tag=a,a,b")).tags).toEqual(["a", "b"]);
  });
});

describe("api params", () => {
  const period = filtersPeriod({ from: "2026-10-01", to: "2026-10-31" }, 1);
  it("sends instants, minor-unit amounts and only non-default switches", () => {
    const p = apiFilterParams(
      {
        ...DEFAULT_FILTERS,
        types: ["EXPENSE"],
        categories: ["none", "c1"],
        min: "12.50",
        groupShares: false,
        planned: "all",
      },
      period,
    );
    expect(p.get("from")).toBe(period.from.toISOString());
    expect(p.get("to")).toBe(period.to.toISOString());
    expect(p.get("type")).toBe("EXPENSE");
    expect(p.get("category")).toBe("none,c1");
    expect(p.get("min")).toBe("1250");
    expect(p.get("include_group_shares")).toBe("false");
    expect(p.get("planned")).toBe("all");
    expect(p.has("hide_adjustments")).toBe(false);
    expect(p.has("max")).toBe(false);
  });
});

describe("period from filters", () => {
  it("treats a whole budgeting month as a month, anything else as custom", () => {
    const month = filtersPeriod({ from: "2026-10-01", to: "2026-10-31" }, 1);
    expect(month.custom).toBeUndefined();
    const custom = filtersPeriod({ from: "2026-10-05", to: "2026-10-20" }, 1);
    expect(custom.custom).toBe(true);
    const shifted = filtersPeriod({ from: "2026-10-15", to: "2026-11-14" }, 15);
    expect(shifted.custom).toBeUndefined();
  });
  it("round-trips dates through a period", () => {
    const p = filtersPeriod({ from: "2026-10-05", to: "2026-10-20" }, 1);
    expect(periodDates(p)).toEqual({ from: "2026-10-05", to: "2026-10-20" });
  });
  it("falls back to the current period without dates", () => {
    const now = new Date(2026, 9, 15);
    expect(filtersPeriod({}, 1, now).from).toEqual(new Date(2026, 9, 1));
  });
  it("presets end with the current period", () => {
    const now = new Date(2026, 9, 15);
    const p = presetPeriod("3m", 1, now);
    expect(p.from).toEqual(new Date(2026, 7, 1));
    expect(p.to).toEqual(new Date(2026, 10, 1));
    expect(presetPeriod("ytd", 1, now).from).toEqual(new Date(2026, 0, 1));
    expect(presetPeriod("12m", 1, now).from).toEqual(new Date(2025, 10, 1));
  });
});

describe("active filter chips", () => {
  const names = {
    accounts: { a1: "Cash" },
    categories: { c1: "Rent" },
    tags: { t1: "trip" },
  };
  it("lists, removes and clears", () => {
    const f = {
      ...DEFAULT_FILTERS,
      from: "2026-10-01",
      to: "2026-10-31",
      accounts: ["a1"],
      categories: ["c1", "none"],
      tags: ["t1"],
      q: "x",
      hideAdjustments: true,
    };
    const chips = activeFilters(f, names);
    expect(chips.map((c) => c.label)).toEqual([
      "Cash",
      "Rent",
      "Uncategorized",
      "#trip",
      "“x”",
      "No adjustments",
    ]);
    expect(removeFilter(f, "category:c1").categories).toEqual(["none"]);
    expect(removeFilter(f, "hideAdjustments").hideAdjustments).toBe(false);
    const cleared = clearFilters(f);
    expect(activeFilters(cleared, names)).toEqual([]);
    expect(cleared.from).toBe("2026-10-01");
  });
});

describe("percent and Other grouping", () => {
  const row = (
    name: string,
    amount: number,
    id: string | null = name,
  ): CategoryRow => ({
    category_id: id,
    name,
    amount,
    count: 1,
    percent: 0,
  });
  it("always sums to 100.0", () => {
    for (const set of [
      [1, 1, 1],
      [333, 333, 334],
      [1, 2, 3, 4, 5, 6, 7],
      [7, 7, 7, 7, 7, 7, 8],
    ]) {
      const sum = roundPercents(set).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 10) / 10).toBe(100);
    }
    expect(roundPercents([0, 0])).toEqual([0, 0]);
  });
  it("keeps up to 8 categories as they are", () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`c${i}`, 100 - i));
    const s = groupSlices(rows);
    expect(s).toHaveLength(8);
    expect(s.some((x) => x.other)).toBe(false);
  });
  it("groups the tail beyond 7 into Other", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(`c${i}`, 1000 - i * 10),
    );
    const s = groupSlices(rows);
    expect(s).toHaveLength(8);
    const other = s[7];
    expect(other).toMatchObject({
      name: "Other",
      other: true,
      count: 3,
      slot: 7,
    });
    expect(other.ids).toEqual(["c7", "c8", "c9"]);
    expect(other.amount).toBe(930 + 920 + 910);
    const sum = s.reduce((a, x) => a + x.percent, 0);
    expect(Math.round(sum * 10) / 10).toBe(100);
  });
  it("maps the uncategorised row to the 'none' filter id and skips zero rows", () => {
    const s = groupSlices([row("Uncategorized", 50, null), row("Zero", 0)]);
    expect(s).toHaveLength(1);
    expect(s[0].ids).toEqual(["none"]);
  });
});

describe("donut geometry", () => {
  it("draws a ring segment and a full ring for a single slice", () => {
    expect(arcPath(100, 100, 98, 64, 0, 0.25)).toMatch(
      /^M [\d.]+ [\d.]+ A 98 98 0 0 1/,
    );
    expect(arcPath(100, 100, 98, 64, 0, 0.75)).toContain("A 98 98 0 1 1");
    expect(arcPath(100, 100, 98, 64, 0, 1)).toContain("Z");
    expect(arcPath(100, 100, 98, 64, 0.2, 0.2)).toBe("");
  });
  it("makes one path per slice", () => {
    const arcs = donutArcs([{ amount: 3 }, { amount: 1 }]);
    expect(arcs).toHaveLength(2);
    expect(arcs.every((a) => a.startsWith("M"))).toBe(true);
    expect(donutArcs([])).toEqual([]);
  });
  it("describes the chart in words", () => {
    expect(
      donutSummary("Spending by category", [
        { name: "Rent", percent: 60 },
        { name: "Food", percent: 40 },
      ]),
    ).toBe("Spending by category: Rent 60 percent, Food 40 percent");
    expect(donutSummary("X", [])).toBe("X: no data");
  });
});

describe("trend helpers", () => {
  const range = (a: Date, b: Date) => ({ from: a, to: b });
  it("picks a bucket by range length and can step coarser", () => {
    expect(
      chooseBucket(range(new Date(2026, 9, 1), new Date(2026, 10, 1))),
    ).toBe("day");
    expect(
      chooseBucket(range(new Date(2026, 6, 1), new Date(2026, 10, 1))),
    ).toBe("week");
    expect(
      chooseBucket(range(new Date(2025, 10, 1), new Date(2026, 10, 1))),
    ).toBe("month");
    expect(coarser("day")).toBe("week");
    expect(coarser("month")).toBeNull();
  });
  it("builds a nice scale", () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    const s = niceScale(1234500);
    expect(s.ticks[0]).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(1234500);
  });
  it("formats compact axis labels", () => {
    expect(compactAmount(80000)).toBe("800");
    expect(compactAmount(4500000)).toBe("45k");
    expect(compactAmount(120000000)).toBe("1.2M");
    expect(compactAmount(-150000)).toBe("−1.5k");
  });
  it("lays out bars on one scale with room for negative net", () => {
    const buckets = [
      {
        start: "2026-10-01",
        end: "2026-10-02",
        income: 1000,
        expense: 2000,
        net: -1000,
      },
      {
        start: "2026-10-02",
        end: "2026-10-03",
        income: 3000,
        expense: 500,
        net: 2500,
      },
    ];
    const g = barLayout(buckets, 200, 100);
    expect(g.bottom).toBeLessThan(0);
    expect(g.top).toBeGreaterThanOrEqual(3000);
    expect(g.bars).toHaveLength(2);
    // Taller value => shorter y; bars rise from the zero line.
    expect(g.bars[1].incomeH).toBeGreaterThan(g.bars[0].incomeH);
    expect(g.bars[0].expenseH).toBeGreaterThan(g.bars[1].expenseH);
    expect(g.bars[0].incomeY + g.bars[0].incomeH).toBeCloseTo(g.zero);
    expect(g.bars[0].netY).toBeGreaterThan(g.zero);
  });
});
