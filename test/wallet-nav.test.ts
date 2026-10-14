import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8");
const shell = read("components/AppShell.tsx");

describe("wallet navigation", () => {
  const nav = shell.slice(
    shell.indexOf("const navigation = ["),
    shell.indexOf("];", shell.indexOf("const navigation = [")),
  );

  it("puts Wallet between Overview and Groups in the sidebar", () => {
    const order = ["/overview", "/wallet", "/groups"].map((href) =>
      nav.indexOf(`href: "${href}"`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("does not link Phase 2/3 pages that do not exist yet", () => {
    for (const label of ["Budgets", "Planned", "Loans", "Reports"])
      expect(nav).not.toContain(label);
  });

  it("guards /wallet routes and keeps /personal reachable", () => {
    expect(shell).toContain('"/wallet",');
    expect(shell).toContain('"/personal",');
    expect(read("app/wallet/page.tsx")).toContain('href="/personal"');
  });

  it("every wallet page referenced in links exists", () => {
    for (const route of [
      "app/wallet/page.tsx",
      "app/wallet/accounts/[id]/page.tsx",
      "app/wallet/categories/page.tsx",
      "app/wallet/categories/[id]/page.tsx",
      "app/wallet/tags/page.tsx",
    ])
      expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
  });
});
