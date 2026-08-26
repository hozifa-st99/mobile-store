"use client";

import Link from "next/link";

const quickBarActions = [
  {
    label: "فاتورة مبيعات",
    hint: "عمل جديد",
    emoji: "🛒",
    href: "/dashboard/sales/new",
    glow: "rgba(124, 58, 237, 0.35)",
    bg: "linear-gradient(145deg, rgba(124, 58, 237, 0.28) 0%, rgba(124, 58, 237, 0.08) 100%)",
    border: "border-primary/25 hover:border-primary/45",
  },
  {
    label: "فاتورة مشتريات",
    hint: "عمل جديد",
    emoji: "📥",
    href: "/dashboard/purchases/new",
    glow: "rgba(6, 182, 212, 0.35)",
    bg: "linear-gradient(145deg, rgba(6, 182, 212, 0.28) 0%, rgba(6, 182, 212, 0.08) 100%)",
    border: "border-cyan-500/25 hover:border-cyan-500/45",
  },
  {
    label: "مرتجع مبيعات",
    hint: "إرجاع فاتورة",
    emoji: "↩️",
    href: "/dashboard/sales/returns",
    glow: "rgba(245, 158, 11, 0.35)",
    bg: "linear-gradient(145deg, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0.08) 100%)",
    border: "border-amber-500/25 hover:border-amber-500/45",
  },
  {
    label: "مرتجع مشتريات",
    hint: "إرجاع فاتورة",
    emoji: "🔄",
    href: "/dashboard/purchases/returns",
    glow: "rgba(244, 63, 94, 0.35)",
    bg: "linear-gradient(145deg, rgba(244, 63, 94, 0.28) 0%, rgba(244, 63, 94, 0.08) 100%)",
    border: "border-rose-500/25 hover:border-rose-500/45",
  },
] as const;

const productQuickActions = [
  {
    label: "الموبايلات",
    hint: "عرض الأجهزة المتاحة",
    emoji: "📲",
    href: "/dashboard/products?tab=phones",
    glow: "rgba(59, 130, 246, 0.35)",
    bg: "linear-gradient(145deg, rgba(59, 130, 246, 0.28) 0%, rgba(59, 130, 246, 0.08) 100%)",
    border: "border-blue-500/25 hover:border-blue-500/45",
  },
  {
    label: "المنتجات",
    hint: "كل أصناف الفرع",
    emoji: "📦",
    href: "/dashboard/products?tab=catalog",
    glow: "rgba(16, 185, 129, 0.35)",
    bg: "linear-gradient(145deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.08) 100%)",
    border: "border-emerald-500/25 hover:border-emerald-500/45",
  },
] as const;

function QuickBarRow({
  actions,
  duo = false,
}: {
  actions: readonly {
    label: string;
    hint: string;
    emoji: string;
    href: string;
    glow: string;
    bg: string;
    border: string;
  }[];
  duo?: boolean;
}) {
  return (
    <div className={`dashboard-quick-bar-inner${duo ? " dashboard-quick-bar-inner--duo" : ""}`}>
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`dashboard-quick-bar-item group border ${action.border}`}
        >
          <span
            className="dashboard-quick-bar-icon"
            style={{
              background: action.bg,
              boxShadow: `0 8px 24px ${action.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
            }}
          >
            <span className="text-xl sm:text-2xl leading-none" aria-hidden>
              {action.emoji}
            </span>
          </span>
          <span className="min-w-0 flex-1 text-right">
            <span className="block text-xs sm:text-sm font-bold text-white group-hover:text-primary-light transition-colors truncate">
              {action.label}
            </span>
            <span className="block text-[10px] sm:text-[11px] text-muted group-hover:text-muted/90 transition-colors truncate">
              {action.hint}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardQuickBar() {
  return (
    <div className="dashboard-quick-bar">
      <QuickBarRow actions={quickBarActions} />
      <QuickBarRow actions={productQuickActions} duo />
    </div>
  );
}
