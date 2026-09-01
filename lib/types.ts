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
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
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
