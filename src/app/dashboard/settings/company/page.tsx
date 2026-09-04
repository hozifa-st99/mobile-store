"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import LogoUpload from "@/components/ui/LogoUpload";
import { apiJson } from "@/lib/api-client";
import { DEFAULT_COMPANY_DISPLAY_NAME } from "@/lib/company-branding";
import { isFullAccessRole } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { useScreenAccess } from "@/hooks/use-screen-access";

interface CompanyForm {
  nameAr: string;
  logoUrl: string | null;
}

export default function CompanySettingsPage() {
  const { role } = useScreenAccess();
  const canEdit = isFullAccessRole(role);
  const updateCompanyName = useAuthStore((s) => s.updateCompanyName);
  const updateCompanyLogoUrl = useAuthStore((s) => s.updateCompanyLogoUrl);

  const [form, setForm] = useState<CompanyForm>({ nameAr: "", logoUrl: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.company) {
          setForm({
            nameAr: data.company.nameAr || "",
            logoUrl: data.company.logoUrl ?? null,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const nameAr = form.nameAr.trim();
    if (!nameAr) {
      toast.error("اسم الشركة مطلوب");
      return;
    }

    setSaving(true);
    try {
      const { ok, data } = await apiJson<{ company?: CompanyForm; message?: string }>(
        "/api/settings/company",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr, logoUrl: form.logoUrl }),
        }
      );

      if (!ok || !data.company) {
        toast.error(data.message || "فشل حفظ بيانات الشركة");
        return;
      }

      setForm({
        nameAr: data.company.nameAr,
        logoUrl: data.company.logoUrl ?? null,
      });
      updateCompanyName(data.company.nameAr);
      updateCompanyLogoUrl(data.company.logoUrl ?? null);
      toast.success("تم حفظ بيانات الشركة");
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <span aria-hidden>➡️</span> رجوع للإعدادات
        </Link>
      </div>

      <PageHeader
        title="بيانات الشركة"
        subtitle="اسم ولوجو المؤسسة — يظهر في تسجيل الدخول وطباعة فاتورة البيع"
      />

      {loading ? (
        <div className="glass-card p-8 text-center text-muted">جاري التحميل...</div>
      ) : (
        <div className="glass-card p-6 max-w-xl space-y-6">
          {!canEdit ? (
            <p className="text-sm text-accent-orange rounded-xl border border-accent-orange/30 bg-accent-orange/5 px-4 py-3">
              العرض فقط — التعديل متاح للأدمن.
            </p>
          ) : null}

          <div>
            <label className="block text-xs text-muted mb-2">اسم الشركة / المؤسسة *</label>
            <input
              value={form.nameAr}
              onChange={(e) => setForm((current) => ({ ...current, nameAr: e.target.value }))}
              className="glass-input w-full"
              placeholder={DEFAULT_COMPANY_DISPLAY_NAME}
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-3">لوجو الشركة</label>
            <LogoUpload
              name={form.nameAr || "الشركة"}
              value={form.logoUrl}
              onChange={(url) => setForm((current) => ({ ...current, logoUrl: url }))}
              size="lg"
            />
            <p className="text-[11px] text-muted mt-2">يظهر في شاشة الدخول وطباعة فاتورة البيع.</p>
          </div>

          {canEdit ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="btn-primary px-6 py-2.5 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
