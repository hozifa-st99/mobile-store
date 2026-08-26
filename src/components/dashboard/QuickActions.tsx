"use client";

import Link from "next/link";

const quickActions = [
  { label: "نقطة بيع جديدة", emoji: "🛒", color: "#7c3aed", border: "border-primary/30", bg: "rgba(124, 58, 237, 0.12)", href: "/dashboard/sales/new" },
  { label: "إدخال بضاعة — رصيد افتتاحي", emoji: "📥", color: "#06b6d4", border: "border-cyan-500/30", bg: "rgba(6, 182, 212, 0.12)", href: "/dashboard/stock-entries/new" },
  { label: "إضافة عميل جديد", emoji: "👥", color: "#10b981", border: "border-accent-green/30", bg: "rgba(16, 185, 129, 0.12)", href: "/dashboard/customers" },
  { label: "فاتورة صيانة جديدة", emoji: "🔧", color: "#f59e0b", border: "border-accent-orange/30", bg: "rgba(245, 158, 11, 0.12)", href: "/dashboard/maintenance" },
];

export default function QuickActions() {
  return (
    <div className="glass-card p-5 h-full">
      <h2 className="section-title mb-4">إجراءات سريعة</h2>
      <div className="space-y-2">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border ${action.border} bg-background-input/40 hover:bg-background-input/70 transition-all group`}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: action.bg }}
            >
              <span className="text-xl">{action.emoji}</span>
            </div>
            <span className="text-sm text-muted group-hover:text-white transition-colors font-medium">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
