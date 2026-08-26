"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import { toast } from "@/lib/toast";
import { ACTIVATION_PERIODS } from "@/lib/permissions";
import { useScreenAccess } from "@/hooks/use-screen-access";

const fieldClass =
  "w-full rounded-xl border border-border bg-background-input px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50";

export default function SiteActivationPage() {
  const { isSuperAdmin } = useScreenAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteActive, setSiteActive] = useState(false);
  const [siteActivatedUntil, setSiteActivatedUntil] = useState<string | null>(null);
  const [activationLabel, setActivationLabel] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState(30);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/site-activation", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر تحميل حالة التفعيل");
      setSiteActive(Boolean(data.siteActive));
      setSiteActivatedUntil(data.siteActivatedUntil);
      setActivationLabel(data.activationLabel ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحميل حالة التفعيل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) loadStatus();
  }, [isSuperAdmin]);

  const activate = async (period: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/site-activation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          period,
          customDays: period === "custom" ? customDays : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر تفعيل الموقع");
      toast.success(data.message || "تم التفعيل");
      setSiteActive(Boolean(data.siteActive));
      setSiteActivatedUntil(data.siteActivatedUntil);
      setActivationLabel(data.activationLabel ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تفعيل الموقع");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/site-activation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر إلغاء التفعيل");
      toast.success(data.message || "تم إلغاء التفعيل");
      setSiteActive(false);
      setSiteActivatedUntil(null);
      setActivationLabel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إلغاء التفعيل");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="glass-card p-8 text-center text-muted">
        هذه الشاشة متاحة للسوبر أدمن فقط.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          ➡️ رجوع للإعدادات
        </Link>
      </div>

      <PageHeader title="تفعيل الموقع" subtitle="صلاحية خاصة بالسوبر أدمن فقط" />

      <div className="glass-card p-6 space-y-6">
        {loading ? (
          <p className="text-muted">جاري التحميل...</p>
        ) : (
          <>
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm text-muted mb-1">الحالة الحالية</p>
              <p className={`text-lg font-bold ${siteActive ? "text-emerald-300" : "text-red-300"}`}>
                {siteActive ? "الموقع مفعّل" : "الموقع غير مفعّل"}
              </p>
              {siteActive && activationLabel && (
                <p className="text-sm text-muted mt-2">
                  {activationLabel === "مدى الحياة"
                    ? "مدة التفعيل: مدى الحياة"
                    : `ينتهي في: ${activationLabel}`}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">تفعيل لمدة</h3>
              <div className="flex flex-wrap gap-2">
                {ACTIVATION_PERIODS.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    disabled={saving}
                    className="btn-secondary px-4 py-2 text-sm"
                    onClick={() => activate(period.key)}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">تفعيل بعدد أيام</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className={`${fieldClass} w-32`}
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value) || 1)}
                />
                <button
                  type="button"
                  disabled={saving}
                  className="btn-primary px-4 py-2 text-sm"
                  onClick={() => activate("custom")}
                >
                  تفعيل
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                onClick={deactivate}
              >
                إلغاء التفعيل
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
