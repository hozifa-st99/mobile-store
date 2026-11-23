"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import { em } from "@/components/ui/TableEmoji";
import { DEFAULT_SALES_SETTINGS, type SalesSettings } from "@/lib/sales-settings";

export default function SalesSettingsPage() {
  const [settings, setSettings] = useState<SalesSettings>(DEFAULT_SALES_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/sales", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const response = await fetch("/api/settings/sales", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.message || "فشل حفظ الإعدادات");
        return;
      }

      if (data.settings) setSettings(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("فشل الحفظ — تحقق من الاتصال");
    } finally {
      setSaving(false);
    }
  };

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
      <PageHeader title="المبيعات" subtitle="إعدادات فواتير المبيعات" />

      <div className="glass-card p-5 space-y-4 max-w-xl">
        <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2 pb-2 border-b border-border/40">
          <span>🛒</span>
          فاتورة مبيعات جديدة
        </h2>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 text-lg">
              🧮
            </div>
            <div>
              <p className="text-sm font-medium text-white">تفعيل الضريبة افتراضياً</p>
              <p className="text-xs text-muted mt-0.5">
                عند فتح فاتورة مبيعات جديدة يكون مربع «ضريبة» مفعّلاً أو غير مفعّل حسب هذا الخيار
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSettings((s) => ({ ...s, defaultTaxEnabled: !s.defaultTaxEnabled }))
            }
            className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
              settings.defaultTaxEnabled
                ? "bg-primary"
                : "bg-background-input border border-border"
            }`}
            aria-pressed={settings.defaultTaxEnabled}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                settings.defaultTaxEnabled ? "left-1" : "right-1"
              }`}
            />
          </button>
        </div>

        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary mt-2 inline-flex items-center gap-2"
        >
          <span>{em.settings}</span>
          {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ الإعدادات"}
        </button>
      </div>
    </>
  );
}