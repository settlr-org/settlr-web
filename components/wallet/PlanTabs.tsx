"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";

const TABS = [
  { href: "/wallet/budgets", label: "Budgets" },
  { href: "/wallet/planned", label: "Planned" },
  { href: "/wallet/loans", label: "Loans" },
];

/** Budgets / Planned / Loans switcher shown on the planning pages. */
export function PlanTabs() {
  const path = usePathname();
  return (
    <div className="plan-tabs-bar">
      <Link href="/wallet" className="back-link">
        <ArrowLeftOutlined /> Wallet
      </Link>
      <nav className="plan-tabs" aria-label="Planning">
        {TABS.map((tab) => {
          const current = path === tab.href || path.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={current ? "active" : undefined}
              aria-current={current ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
