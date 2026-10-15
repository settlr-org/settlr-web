import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8");
const shell = read("components/AppShell.tsx");

describe("wallet navigation", () => {
  const nav = shell.slice(
    shell.indexOf("const navigation"),
    shell.indexOf("type ShellConfig"),
  );

  it("puts Wallet between Overview and Groups in the sidebar", () => {
    const order = ["/overview", "/wallet", "/groups"].map((href) =>
      nav.indexOf(`href: "${href}"`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("nests Budgets & planned and Loans under Wallet", () => {
    const wallet = nav.indexOf('href: "/wallet"');
    const budgets = nav.indexOf('href: "/wallet/budgets"');
    const loans = nav.indexOf('href: "/wallet/loans"');
    const groups = nav.indexOf('href: "/groups"');
    expect(nav).toContain('label: "Budgets & planned"');
    expect(nav).toContain('label: "Loans"');
    expect(wallet).toBeLessThan(budgets);
    expect(budgets).toBeLessThan(loans);
    expect(loans).toBeLessThan(groups);
  });

  it("does not link Phase 3 pages that do not exist yet", () => {
    expect(nav).not.toContain("Reports");
  });

  it("guards /wallet routes and keeps /personal stats reachable", () => {
    expect(shell).toContain('"/wallet",');
    expect(shell).toContain('"/personal",');
    const wallet = read("app/wallet/page.tsx");
    expect(wallet).toContain('href="/personal"');
    expect(wallet).toContain("Personal stats &amp; export");
    expect(wallet).toContain('href="/wallet/budgets"');
    expect(wallet).toContain('href="/wallet/loans"');
  });

  it("every wallet page referenced in links exists", () => {
    for (const route of [
      "app/wallet/page.tsx",
      "app/wallet/accounts/[id]/page.tsx",
      "app/wallet/categories/page.tsx",
      "app/wallet/categories/[id]/page.tsx",
      "app/wallet/tags/page.tsx",
      "app/wallet/budgets/page.tsx",
      "app/wallet/planned/page.tsx",
      "app/wallet/loans/page.tsx",
      "app/wallet/loans/[id]/page.tsx",
    ])
      expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
  });
});
