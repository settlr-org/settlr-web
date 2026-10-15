import { describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime, formatTime } from "../lib/dates";
import { EXPORTS } from "../lib/exports";
import { readFlag, writeFlag } from "../lib/prefs";
import {
  cadenceText,
  hasAnyResults,
  normalizeSearch,
  searchCount,
} from "../lib/search";
import { buildLedgerQuery } from "../lib/wallet";
import { friendlyMessage } from "../lib/errors";

describe("shared date formatter", () => {
  const now = new Date(2026, 9, 15, 12);
  it("omits the year within the current year", () => {
    expect(formatDate(new Date(2026, 9, 15), now, "en-US")).toBe("Oct 15");
  });
  it("adds the year otherwise", () => {
    expect(formatDate(new Date(2025, 11, 31), now, "en-US")).toBe(
      "Dec 31, 2025",
    );
  });
  it("formats times and date-times", () => {
    const d = new Date(2026, 9, 15, 9, 0);
    expect(formatTime(d, "en-US")).toMatch(/^9:00\sAM$/);
    expect(formatDateTime(d, now, "en-US")).toMatch(/^Oct 15, 9:00\sAM$/);
  });
  it("tolerates missing or invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("nope")).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });
});

describe("search results", () => {
  it("fills missing wallet keys so older servers still render", () => {
    const r = normalizeSearch({ groups: [{ id: "g", name: "Trip" }] });
    expect(r.transactions).toEqual([]);
    expect(r.tags).toEqual([]);
    expect(searchCount(r)).toBe(1);
    expect(hasAnyResults(r)).toBe(true);
  });
  it("reports no matches only when every list is empty", () => {
    expect(hasAnyResults(normalizeSearch(null))).toBe(false);
    expect(
      hasAnyResults(normalizeSearch({ tags: [{ id: "t", name: "trip" }] })),
    ).toBe(true);
  });
  it("describes cadences", () => {
    expect(
      cadenceText({ one_time: true, interval_n: 1, interval_unit: "MONTH" }),
    ).toBe("one-time");
    expect(
      cadenceText({ one_time: false, interval_n: 1, interval_unit: "MONTH" }),
    ).toBe("monthly");
    expect(
      cadenceText({ one_time: false, interval_n: 2, interval_unit: "WEEK" }),
    ).toBe("every 2 weeks");
  });
});

describe("adjustments toggle", () => {
  it("sends hide_adjustments only when asked", () => {
    expect(buildLedgerQuery({ hideAdjustments: true, limit: 30 })).toBe(
      "?hide_adjustments=true&limit=30",
    );
    expect(buildLedgerQuery({ limit: 30 })).toBe("?limit=30");
  });
  it("remembers the choice and survives broken storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
      removeItem: (k: string) => void values.delete(k),
    };
    expect(readFlag("k", storage)).toBe(false);
    writeFlag("k", true, storage);
    expect(readFlag("k", storage)).toBe(true);
    writeFlag("k", false, storage);
    expect(readFlag("k", storage)).toBe(false);
    const broken = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    expect(readFlag("k", broken)).toBe(false);
    expect(() => writeFlag("k", true, broken)).not.toThrow();
  });
});

describe("exports", () => {
  it("offers the full backup first and every CSV with a description", () => {
    expect(EXPORTS[0]).toMatchObject({
      label: "All my data (JSON)",
      path: "/api/v1/me/export.json",
    });
    expect(EXPORTS.map((e) => e.label)).toEqual([
      "All my data (JSON)",
      "Transactions (CSV)",
      "Accounts (CSV)",
      "Budgets (CSV)",
      "Loans (CSV)",
      "Group expenses (CSV)",
    ]);
    for (const e of EXPORTS) {
      expect(e.description.length).toBeGreaterThan(10);
      expect(e.filename).toMatch(/^settlr-.*\.(json|csv)$/);
    }
    expect(EXPORTS.find((e) => e.key === "groups")?.path).toBe(
      "/api/v1/me/export.csv",
    );
  });
});

describe("search validation errors", () => {
  it("keeps the API's validation detail for unknown filter values", () => {
    expect(friendlyMessage(422, "VALIDATION_ERROR", "unknown source FOO")).toBe(
      "Unknown source FOO.",
    );
  });
});
