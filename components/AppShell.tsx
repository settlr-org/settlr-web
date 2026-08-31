"use client";
import {
  createContext,
  Fragment,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellOutlined,
  HomeOutlined,
  LogoutOutlined,
  MoonOutlined,
  PieChartOutlined,
  PlusOutlined,
  SettingOutlined,
  SearchOutlined,
  SunOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Brand } from "./Brand";
import { Modal } from "./UI";
import { useSession } from "./SessionProvider";
import { initials } from "../lib/types";
const navigation = [
  { href: "/overview", label: "Overview", icon: <HomeOutlined /> },
  { href: "/groups", label: "Groups", icon: <TeamOutlined /> },
  { href: "/friends", label: "Friends", icon: <UserOutlined /> },
  { href: "/personal", label: "Personal", icon: <PieChartOutlined /> },
  { href: "/activity", label: "Activity", icon: <UnorderedListOutlined /> },
];
type ShellConfig = {
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
};
const ShellContext = createContext<((config: ShellConfig) => void) | undefined>(
  undefined,
);

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
  const configure = useContext(ShellContext);
  useLayoutEffect(() => {
    configure?.({ title, eyebrow, description, actions });
  }, [configure, title, eyebrow, description, actions]);
  return <Fragment>{children}</Fragment>;
}

const workspacePrefixes = [
  "/overview",
  "/groups",
  "/friends",
  "/personal",
  "/activity",
  "/notifications",
  "/settings",
  "/search",
  "/invites",
  "/invite",
  "/expenses",
];

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [config, setConfig] = useState<ShellConfig>({
    title: "Workspace",
    eyebrow: "SETTLR",
    description: "Shared money, made clear.",
  });
  const [addOpen, setAddOpen] = useState(false);
  const workspace = workspacePrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  useEffect(() => {
    if (workspace && !loading && !user)
      router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [workspace, loading, user, router, path]);
  const toggleTheme = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("settlr_theme", next);
  };
  if (!workspace) return children;
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
      <aside className="sidebar">
        <Brand />
        <p className="brand-tagline">Shared money, made clear.</p>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
            href="/search"
            className={path === "/search" ? "nav-item active" : "nav-item"}
          >
            <SearchOutlined />
            <span>Search</span>
          </Link>
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
      <main className="content">
        <header className="topbar">
          <div className="page-heading">
            <p className="eyebrow">{config.eyebrow}</p>
            <h1>{config.title}</h1>
            <p className="subtitle">{config.description}</p>
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
            {config.actions ?? (
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
        <ShellContext.Provider value={setConfig}>
          {children}
        </ShellContext.Provider>
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
        <Link
          className={path === "/friends" ? "nav-item active" : "nav-item"}
          href="/friends"
        >
          <UserOutlined />
          <span>Friends</span>
        </Link>
        <button
          className="mobile-add"
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add expense"
        >
          <PlusOutlined />
        </button>
        <Link
          className={path === "/personal" ? "nav-item active" : "nav-item"}
          href="/personal"
        >
          <PieChartOutlined />
          <span>Personal</span>
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
          <span>Settings</span>
        </Link>
      </nav>
      {addOpen && (
        <Modal
          title="Add an expense"
          subtitle="Choose where this expense belongs."
          onClose={() => setAddOpen(false)}
        >
          <div className="modal-actions">
            <button
              className="button primary full"
              onClick={() => {
                setAddOpen(false);
                router.push("/groups");
              }}
            >
              <TeamOutlined /> Shared expense
            </button>
            <button
              className="button full"
              onClick={() => {
                setAddOpen(false);
                router.push("/personal?new=1");
              }}
            >
              <WalletOutlined /> Personal expense
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
