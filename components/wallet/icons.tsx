"use client";
import type { ComponentType } from "react";
import {
  BankOutlined,
  BookOutlined,
  CarOutlined,
  CloudOutlined,
  CoffeeOutlined,
  CompassOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  FireOutlined,
  GiftOutlined,
  GlobalOutlined,
  GoldOutlined,
  HeartOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  MobileOutlined,
  MoneyCollectOutlined,
  ReadOutlined,
  RestOutlined,
  SendOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SkinOutlined,
  SmileOutlined,
  SolutionOutlined,
  SoundOutlined,
  StarOutlined,
  StockOutlined,
  TagOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  VideoCameraOutlined,
  WalletOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { colourCss } from "../../lib/wallet";

// Icon keys are shared with Android and the API seed (lucide-style names);
// each maps to the closest Ant Design glyph on the web.
const ICONS: Record<string, ComponentType> = {
  wallet: WalletOutlined,
  bank: BankOutlined,
  cash: DollarOutlined,
  "credit-card": CreditCardOutlined,
  savings: GoldOutlined,
  invest: StockOutlined,
  salary: MoneyCollectOutlined,
  work: SolutionOutlined,
  smartphone: MobileOutlined,
  wifi: WifiOutlined,
  home: HomeOutlined,
  building: ShopOutlined,
  sofa: RestOutlined,
  "shopping-cart": ShoppingCartOutlined,
  bag: ShoppingOutlined,
  shirt: SkinOutlined,
  utensils: CoffeeOutlined,
  cup: CoffeeOutlined,
  wine: ExperimentOutlined,
  car: CarOutlined,
  bus: CarOutlined,
  bike: CompassOutlined,
  fuel: DashboardOutlined,
  plane: SendOutlined,
  travel: GlobalOutlined,
  "square-parking": EnvironmentOutlined,
  zap: ThunderboltOutlined,
  droplets: CloudOutlined,
  sparkles: StarOutlined,
  heart: HeartOutlined,
  health: MedicineBoxOutlined,
  baby: SmileOutlined,
  book: BookOutlined,
  education: ReadOutlined,
  film: VideoCameraOutlined,
  music: SoundOutlined,
  gamepad: TrophyOutlined,
  activity: FireOutlined,
  gift: GiftOutlined,
  tag: TagOutlined,
};

/** Icons offered in pickers (a curated subset; unknown keys still render). */
export const ICON_CHOICES = [
  "wallet",
  "bank",
  "cash",
  "credit-card",
  "savings",
  "invest",
  "salary",
  "work",
  "home",
  "utensils",
  "shopping-cart",
  "bag",
  "car",
  "plane",
  "zap",
  "smartphone",
  "health",
  "education",
  "film",
  "gift",
  "heart",
  "activity",
  "tag",
  "sparkles",
];

export function WalletIcon({ name }: { name?: string }) {
  const Icon = (name && ICONS[name]) || TagOutlined;
  return <Icon />;
}

/** Coloured tile with an item's icon (account, category or tag). */
export function ItemTile({
  icon,
  color,
  size = "md",
}: {
  icon?: string;
  color?: string | null;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`item-tile item-tile-${size}`}
      style={{ ["--tile" as string]: colourCss(color) }}
      aria-hidden="true"
    >
      <WalletIcon name={icon} />
    </span>
  );
}
