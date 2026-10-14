export type User = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  default_currency?: string;
  timezone?: string;
  email_verified?: boolean;
  has_password?: boolean;
};
export type Balance = {
  summary: { you_are_owed: number; you_owe: number; net_balance: number };
  currency: string;
  data: GroupBalance[];
};
export type GroupBalance = {
  group_id: string;
  group_name: string;
  currency: string;
  balance: number;
};
export type Currency = string;
export type GroupType = "HOME" | "TRIP" | "COUPLE" | "EVENT" | "OTHER" | string;
export type SplitMode = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES" | string;
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | string;

export type Group = {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  currency: Currency;
  group_type: GroupType;
  simplify_debts: boolean;
  created_by: string;
  information?: string;
};
export type Member = {
  id: string;
  name: string;
  avatar_url?: string;
  role: MemberRole;
  joined_at?: string;
};
export type Expense = {
  id: string;
  group_id?: string;
  description: string;
  amount: number;
  currency: Currency;
  split_mode: SplitMode;
  paid_by: string;
  category_id?: string | null;
  notes?: string;
  expense_date: string;
  created_at?: string;
  splits?: Split[];
  /** Payer's wallet account (returned to the payer only). */
  payer_account_id?: string | null;
};
export type Split = {
  user_id: string;
  amount?: number;
  percentage?: number;
  shares?: number;
};
export type Event = {
  id: string;
  group_id?: string;
  actor_id?: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  created_at: string;
};
export type ActivityEvent = Event;
export type Friend = {
  friendship_id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  status: string;
};
export type FriendRequest = {
  friendship_id: string;
  from_user: string;
  name: string;
  avatar_url?: string;
  created_at: string;
};
export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
};
export type Category = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};
export type Debt = { from_user: string; to_user: string; amount: number };
export type Settlement = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: Currency;
  note?: string;
  settled_at: string;
  /** The caller's linked wallet account for this settlement (either side). */
  account_id?: string | null;
};
export type Attachment = {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};
export type Comment = {
  id: string;
  user_id: string;
  name: string;
  body: string;
  created_at: string;
};
export type PersonalExpense = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  category_id?: string | null;
  notes?: string;
  expense_date: string;
};

export const money = (amount: number, currency = "NPR") => {
  try {
    // Design rule: always show the currency code (e.g. "USD 12.00", never a bare "$").
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount / 100);
  }
};
export const initials = (name = "You") =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const labelize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Today's date as YYYY-MM-DD in the user's own time zone (toISOString would use UTC). */
export const todayISO = (date = new Date()) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

/** Friendly name for a session's user agent, e.g. "Chrome on macOS" (matches Android's deviceLabel). */
export function deviceLabel(userAgent?: string | null): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "Unknown device";
  if (/^settlr-android/i.test(ua)) return "Settlr for Android";
  if (/^mozilla\//i.test(ua)) {
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
    const os = /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
    return os ? `${browser} on ${os}` : browser;
  }
  return ua.slice(0, 60);
}

/** Session IP without its port: "[::1]:5718" → "::1", "10.0.0.2:443" → "10.0.0.2". */
export function displayIp(ip?: string | null): string {
  const v = (ip ?? "").trim();
  if (!v) return "";
  if (v.startsWith("["))
    return v.slice(1, v.indexOf("]") > 0 ? v.indexOf("]") : undefined);
  return v.split(":").length === 2 ? v.split(":")[0] : v;
}

/** True for user agents from phones/tablets, so the session row can show a phone icon. */
export const isMobileAgent = (userAgent?: string | null) =>
  /android|iphone|ipad|mobile/i.test(userAgent ?? "");
