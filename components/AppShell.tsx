"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  PieChartOutlined,
  PlusOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Brand } from "./Brand";
import { useSession } from "./SessionProvider";
import { initials } from "../lib/types";
const navigation = [
  { href: "/overview", label: "Overview", icon: <HomeOutlined /> },
  { href: "/groups", label: "Groups", icon: <TeamOutlined /> },
  { href: "/friends", label: "Friends", icon: <UserOutlined /> },
  { href: "/personal", label: "Personal", icon: <PieChartOutlined /> },
  { href: "/activity", label: "Activity", icon: <UnorderedListOutlined /> },
];
export function AppShell({
  title,
  eyebrow = "SETTLR WORKSPACE",
  description,
  children,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { user, loading, signOut } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!loading && !user)
      router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);
  useEffect(() => {
    if (!menu) return;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", closeMenu);
    return () => document.removeEventListener("keydown", closeMenu);
  }, [menu]);
  const toggleTheme = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("settlr_theme", next);
  };
  if (loading || !user)
    return (
      <div className="route-loading">
        <span />
        <p>Opening your ledger…</p>
      </div>
    );
  const leave = async () => {
    await signOut();
    router.replace("/login");
  };
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="sidebar-mobile-head">
          <Brand />
          <button
            className="icon-button"
            onClick={() => setMenu(false)}
            aria-label="Close navigation menu"
          >
            <MenuOutlined />
          </button>
        </div>
        <Brand />
        <p className="brand-tagline">Shared money, made clear.</p>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenu(false)}
              className={
                path.startsWith(item.href) ? "nav-item active" : "nav-item"
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-secondary">
          <Link
            href="/notifications"
            className={
              path === "/notifications" ? "nav-item active" : "nav-item"
            }
          >
            <BellOutlined />
            <span>Notifications</span>
          </Link>
          <Link
            href="/settings"
            className={path === "/settings" ? "nav-item active" : "nav-item"}
          >
            <SettingOutlined />
            <span>Settings</span>
          </Link>
        </div>
        <button className="profile" onClick={() => router.push("/settings")}>
          <span className="avatar">{initials(user.name)}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
          <SettingOutlined />
        </button>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            <MenuOutlined />
          </button>
          <div className="page-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="subtitle">{description}</p>
          </div>
          <div className="top-actions">
            <Link
              className="icon-button"
              href="/notifications"
              aria-label="Notifications"
            >
              <BellOutlined />
            </Link>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Switch theme"
            >
              <MoonOutlined className="theme-icon theme-icon-light" />
              <SunOutlined className="theme-icon theme-icon-dark" />
            </button>
            {actions ?? (
              <Link className="button primary" href="/groups">
                <PlusOutlined /> Add expense
              </Link>
            )}
            <button
              className="icon-button desktop-logout"
              onClick={leave}
              aria-label="Sign out"
            >
              <LogoutOutlined />
            </button>
          </div>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link
          className={path === "/overview" ? "nav-item active" : "nav-item"}
          href="/overview"
        >
          <HomeOutlined />
          <span>Home</span>
        </Link>
        <Link
          className={
            path.startsWith("/groups") ? "nav-item active" : "nav-item"
          }
          href="/groups"
        >
          <TeamOutlined />
          <span>Groups</span>
        </Link>
        <Link className="mobile-add" href="/groups" aria-label="Add expense">
          <PlusOutlined />
        </Link>
        <Link
          className={path === "/activity" ? "nav-item active" : "nav-item"}
          href="/activity"
        >
          <UnorderedListOutlined />
          <span>Activity</span>
        </Link>
        <Link
          className={path === "/settings" ? "nav-item active" : "nav-item"}
          href="/settings"
        >
          <WalletOutlined />
          <span>Account</span>
        </Link>
      </nav>
    </div>
  );
}
