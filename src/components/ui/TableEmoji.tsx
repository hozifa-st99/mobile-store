import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** إيموجي موحّدة لكل الجداول — نفس أسلوب الشاشة الرئيسية */
export const em = {
  invoice: "🧾",
  customer: "👤",
  customers: "👥",
  total: "💰",
  status: "📊",
  date: "📅",
  payment: "💳",
  phone: "📞",
  address: "📍",
  email: "✉️",
  name: "👤",
  product: "📦",
  type: "🏷️",
  quantity: "🔢",
  purchasePrice: "💵",
  salePrice: "💰",
  actions: "⚙️",
  edit: "✏️",
  delete: "🗑️",
  search: "🔍",
  supplier: "🚚",
  maintenance: "🔧",
  device: "📱",
  order: "📋",
  category: "📂",
  description: "📝",
  imei: "📲",
  serial: "🏷️",
  image: "🖼️",
  branch: "🏢",
  role: "🛡️",
  username: "🔑",
  issue: "⚠️",
  cost: "💸",
  number: "#️⃣",
  series: "📱",
  view: "👁️",
  add: "➕",
  minQuantity: "📉",
  warning: "⚠️",
  bell: "🔔",
  report: "📊",
  profitUp: "📈",
  profitDown: "📉",
  settings: "⚙️",
  color: "🎨",
  storage: "💾",
  ram: "⚡",
  battery: "🔋",
  warranty: "🛡️",
  box: "📦",
  tax: "🧾",
  model: "📱",
  cycle: "🔄",
  link: "🔗",
  print: "🖨️",
  sheet: "📄",
  thermal: "🧾",
  fontSize: "🔤",
  copies: "📑",
} as const;

export function ThEmoji({
  emoji,
  children,
  className,
}: {
  emoji?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("text-xs font-bold text-muted", className)}>
      <span className="inline-flex items-center gap-1.5">
        {emoji ? <span aria-hidden>{emoji}</span> : null}
        <span>{children}</span>
      </span>
    </th>
  );
}

export function CellEmoji({
  emoji,
  children,
  className,
  fallback = "—",
}: {
  emoji?: string;
  children?: ReactNode;
  className?: string;
  fallback?: string;
}) {
  const empty =
    children === null ||
    children === undefined ||
    children === "" ||
    children === "—";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {emoji && !empty ? (
        <span aria-hidden className="opacity-85 flex-shrink-0">
          {emoji}
        </span>
      ) : null}
      <span>{empty ? fallback : children}</span>
    </span>
  );
}

export function ActionEmoji({
  emoji,
  title,
  onClick,
  className,
  type = "button",
}: {
  emoji: string;
  title: string;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-lg border border-border flex items-center justify-center transition-colors text-base leading-none",
        className
      )}
    >
      {emoji}
    </button>
  );
}
