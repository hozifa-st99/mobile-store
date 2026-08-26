"use client";

import Link from "next/link";

const alerts = [
  { emoji: "⚠️", color: "#f59e0b", title: "مخزون منخفض", desc: "5 منتجات تحتاج إعادة طلب" },
  { emoji: "🔧", color: "#7c3aed", title: "صيانة مستحقة", desc: "3 أجهزة في انتظار الصيانة" },
  { emoji: "📄", color: "#3b82f6", title: "فواتير مستحقة", desc: "12 فاتورة لم يتم تحصيلها" },
];

export default function DashboardAlerts() {
  return (
    <div className="glass-card p-5 h-full">
      <h2 className="section-title mb-4">التنبيهات</h2>
      <div className="space-y-2.5">
        {alerts.map((alert) => (
          <div
            key={alert.title}
            className="flex items-start gap-3 p-3 rounded-xl bg-background-input/40 border border-border"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${alert.color}18` }}
            >
              <span className="text-lg">{alert.emoji}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{alert.title}</p>
              <p className="text-xs text-muted-dark mt-0.5">{alert.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/dashboard/settings/notifications"
        className="block w-full mt-4 text-xs font-medium text-primary-light hover:text-white transition-colors text-center"
      >
        عرض جميع التنبيهات
      </Link>
    </div>
  );
}
