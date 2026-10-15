import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { nextRadioIndex } from "../lib/a11y";
import { plural } from "../lib/format";
import { amountScale } from "../lib/wallet";
import { DeferredActions, withoutHeld } from "../lib/undo";
import { matchesConfirmText } from "../components/UI";

describe("plural", () => {
  it("never says '1 results'", () => {
    expect(plural(0, "result")).toBe("0 results");
    expect(plural(1, "result")).toBe("1 result");
    expect(plural(2, "match", "matches")).toBe("2 matches");
    expect(plural(1, "person", "people")).toBe("1 person");
  });
});

describe("amountScale", () => {
  it("steps long figures down so they fit their card", () => {
    expect(amountScale("NPR 13,300.00")).toBe("normal");
    expect(amountScale("EUR 999,999,999.99")).toBe("long");
    expect(amountScale("NPR 170,020,528,475.20")).toBe("huge");
  });
});

describe("nextRadioIndex", () => {
  it("moves with arrows and wraps at the ends", () => {
    expect(nextRadioIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextRadioIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextRadioIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextRadioIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextRadioIndex("Home", 2, 3)).toBe(0);
    expect(nextRadioIndex("End", 0, 3)).toBe(2);
  });
  it("ignores other keys and empty groups", () => {
    expect(nextRadioIndex("a", 0, 3)).toBeNull();
    expect(nextRadioIndex("ArrowRight", 0, 0)).toBeNull();
    expect(nextRadioIndex("ArrowRight", -1, 3)).toBe(1);
  });
});

describe("matchesConfirmText", () => {
  it("requires the typed word, ignoring case and spaces", () => {
    expect(matchesConfirmText("", "DELETE")).toBe(false);
    expect(matchesConfirmText("delete ", "DELETE")).toBe(true);
    expect(matchesConfirmText("remove", "DELETE")).toBe(false);
    expect(matchesConfirmText("", undefined)).toBe(true);
  });
});

describe("DeferredActions (undo)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the action after the grace period", () => {
    const run = vi.fn();
    const queue = new DeferredActions();
    queue.schedule("a", run, 1000);
    expect(queue.has("a")).toBe(true);
    vi.advanceTimersByTime(999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(queue.has("a")).toBe(false);
  });

  it("does not run an action that was undone", () => {
    const run = vi.fn();
    const queue = new DeferredActions();
    queue.schedule("a", run, 1000);
    expect(queue.undo("a")).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
    expect(queue.undo("a")).toBe(false);
  });

  it("is too late to undo once the action has run", () => {
    const queue = new DeferredActions();
    queue.schedule("a", () => undefined, 10);
    vi.advanceTimersByTime(10);
    expect(queue.undo("a")).toBe(false);
  });

  it("commits the earlier action when the same key is scheduled again", () => {
    const first = vi.fn();
    const second = vi.fn();
    const queue = new DeferredActions();
    queue.schedule("a", first, 1000);
    queue.schedule("a", second, 1000);
    expect(first).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("flushAll sends everything queued (leaving the page)", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const queue = new DeferredActions();
    queue.schedule("a", a, 10_000);
    queue.schedule("b", b, 10_000);
    await queue.flushAll();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(queue.has("a")).toBe(false);
  });

  it("hides held items from lists", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    expect(withoutHeld(items, new Set(["2"]))).toEqual([
      { id: "1" },
      { id: "3" },
    ]);
    expect(withoutHeld(items, new Set())).toBe(items);
  });
});

// WCAG 2.4.2: every route needs its own title, set through Next metadata.
describe("document titles", () => {
  const root = join(__dirname, "..", "app");
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") pages.push(dir);
    }
  };
  walk(root);

  it("finds the routes", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it("gives every route except the landing page a layout with a title", () => {
    const missing = pages
      .filter((dir) => dir !== root)
      .filter((dir) => {
        const layout = join(dir, "layout.tsx");
        return (
          !existsSync(layout) ||
          !/export const metadata[^=]*=\s*\{\s*title:\s*"[^"]+"/.test(
            readFileSync(layout, "utf8"),
          )
        );
      })
      .map((dir) => dir.replace(root, ""));
    expect(missing).toEqual([]);
  });

  it("uses titles that are unique per route family", () => {
    const titles = pages
      .filter((dir) => dir !== root)
      .map(
        (dir) =>
          /title:\s*"([^"]+)"/.exec(
            readFileSync(join(dir, "layout.tsx"), "utf8"),
          )?.[1],
      );
    // Detail pages may share a family name with their list ("Account" vs "Wallet"),
    // but no two distinct routes should reuse the exact same title.
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it("appends the product name through the root template", () => {
    const layout = readFileSync(join(root, "layout.tsx"), "utf8");
    expect(layout).toMatch(/template:\s*"%s · Settlr"/);
  });
});
