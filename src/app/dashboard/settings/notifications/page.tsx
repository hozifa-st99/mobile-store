"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import { em } from "@/components/ui/TableEmoji";

interface NotificationSettings {
  lowStockAlert: boolean;
  lowStockThreshold: number;
  installmentReminder: boolean;
  maintenanceReady: boolean;
  dailySalesReport: boolean;
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    lowStockAlert: true,
    lowStockThreshold: 5,
    installmentReminder: true,
    maintenanceReady: true,
    dailySalesReport: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings/notifications", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggle = (key: keyof NotificationSettings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const items = [
    {
      key: "lowStockAlert" as const,
      title: "تنبيه المخزون المنخفض",
      desc: "إشعار عند وصول منتج للحد الأدنى",
      emoji: em.product,
    },
    {
      key: "installmentReminder" as const,
      title: "تذكير الأقساط",
      desc: "تنبيه بمواعيد تحصيل الأقساط",
      emoji: em.payment,
    },
    {
      key: "maintenanceReady" as const,
      title: "جهاز الصيانة جاهز",
      desc: "إشعار العميل عند جاهزية الجهاز",
      emoji: em.maintenance,
    },
    {
      key: "dailySalesReport" as const,
      title: "تقرير مبيعات يومي",
      desc: "ملخص مبيعات نهاية اليوم",
      emoji: em.report,
    },
  ];

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="ArrowRight">
            ➡️
          </span>{" "}
          رجوع للإعدادات
        </Link>
      </div>
      <PageHeader title="التنبيهات" subtitle="إعدادات التنبيهات والإشعارات" />

      <div className="glass-card p-5 space-y-4 max-w-xl">
        <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2 pb-2 border-b border-border/40">
          <span>{em.bell}</span>
          قائمة التنبيهات
        </h2>

        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 text-lg">
                {item.emoji}
              </div>
              <div>
                <p className="text-sm font-medium text-white inline-flex items-center gap-1.5">
                  <span aria-hidden>{item.emoji}</span>
                  {item.title}
                </p>
                <p className="text-xs text-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggle(item.key)}
              className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                settings[item.key] ? "bg-primary" : "bg-background-input border border-border"
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                  settings[item.key] ? "left-1" : "right-1"
                }`}
              />
            </button>
          </div>
        ))}

        <div className="pt-2">
          <label className="text-sm text-muted inline-flex items-center gap-2 mb-2">
            <span>{em.minQuantity}</span>
            حد تنبيه المخزون
          </label>
          <input
            type="number"
            min={1}
            value={settings.lowStockThreshold}
            onChange={(e) =>
              setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })
            }
            className="glass-input w-32"
          />
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary mt-4 inline-flex items-center gap-2">
          <span>{em.settings}</span>
          {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ الإعدادات"}
        </button>
      </div>
    </>
  );
}
