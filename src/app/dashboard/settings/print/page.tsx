"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import BarcodePrintSettingsPanel from "@/components/print/BarcodePrintSettingsPanel";
import InvoiceContactSettingsPanel from "@/components/print/InvoiceContactSettingsPanel";
import PrintPreviewModal from "@/components/print/PrintPreviewModal";
import { em } from "@/components/ui/TableEmoji";
import {
  DEFAULT_PRINT_SETTINGS,
  SHEET_PAPER_SIZES,
  THERMAL_PAPER_SIZES,
  type PrintSettings,
} from "@/lib/print-settings";
import { useAuthStore } from "@/store/auth-store";

type PrintSettingsTab = "invoice" | "barcode";

function SectionHeading({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2 pb-2 border-b border-border/40 w-full">
      <span aria-hidden>{emoji}</span>
      {children}
    </h2>
  );
}

function FieldLabel({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <label className="text-sm text-muted mb-2 inline-flex items-center gap-2">
      <span aria-hidden>{emoji}</span>
      {children}
    </label>
  );
}

export default function PrintSettingsPage() {
  const { user, selectedBranch } = useAuthStore();
  const [activeTab, setActiveTab] = useState<PrintSettingsTab>("invoice");
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [companyPreviewName, setCompanyPreviewName] = useState<string | null>(null);
  const [companyPreviewLogoUrl, setCompanyPreviewLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch("/api/settings/print", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {
        /* keep defaults */
      });

    fetch("/api/settings/company", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.company) {
          setCompanyPreviewName(data.company.nameAr ?? null);
          setCompanyPreviewLogoUrl(data.company.logoUrl ?? null);
        }
      })
      .catch(() => {
        /* keep session defaults */
      });
  }, []);

  const previewContext = useMemo(
    () => ({
      companyName: companyPreviewName || user?.companyName || "اسم المحل",
      companyLogoUrl: companyPreviewLogoUrl,
      branchName: selectedBranch?.name,
      branchAddress: selectedBranch?.address,
      branchPhone: selectedBranch?.phone,
      invoiceCreatorName: user?.fullName ?? null,
    }),
    [user, selectedBranch, companyPreviewName, companyPreviewLogoUrl]
  );

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const response = await fetch("/api/settings/print", {
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

  const renderPaperSizeButton = (
    size: (typeof THERMAL_PAPER_SIZES)[number],
    variant: "thermal" | "sheet"
  ) => {
    const selected = settings.paperSize === size.value;
    const thermalActive = selected && variant === "thermal";
    const sheetActive = selected && variant === "sheet";

    return (
      <button
        key={size.value}
        type="button"
        onClick={() => setSettings((current) => ({ ...current, paperSize: size.value }))}
        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
          thermalActive
            ? "border-amber-400/80 bg-amber-500/25 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
            : sheetActive
              ? "border-sky-400/80 bg-sky-500/25 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
              : variant === "thermal"
                ? "border-amber-500/25 bg-black/20 text-muted hover:border-amber-400/40 hover:text-amber-100"
                : "border-sky-500/25 bg-black/20 text-muted hover:border-sky-400/40 hover:text-sky-100"
        }`}
      >
        {size.label}
      </button>
    );
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none">➡️</span>
          رجوع للإعدادات
        </Link>
      </div>

      <PageHeader title="إعدادات الطباعة" subtitle="فواتير المبيعات وملصقات الباركود" />

      <div className="flex gap-2 mb-5 max-w-3xl">
        <button
          type="button"
          onClick={() => setActiveTab("invoice")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 ${
            activeTab === "invoice"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          <span aria-hidden>{em.invoice}</span>
          طباعة الفواتير
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("barcode")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 ${
            activeTab === "barcode"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          <span aria-hidden>{em.serial}</span>
          طباعة الباركود
        </button>
      </div>

      {activeTab === "barcode" ? (
        <div className="glass-card p-5 max-w-3xl">
          <BarcodePrintSettingsPanel />
        </div>
      ) : (
      <div className="glass-card p-5 space-y-5 max-w-3xl">
        <section className="space-y-3">
          <SectionHeading emoji={em.print}>مقاس الورق</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/12 via-amber-600/5 to-transparent p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/25 border border-amber-400/30 flex items-center justify-center text-2xl flex-shrink-0">
                  {em.thermal}
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-100 inline-flex items-center gap-1.5">
                    <span aria-hidden>{em.thermal}</span>
                    طابعات حرارية
                  </p>
                  <p className="text-xs text-amber-200/60 mt-0.5">58 — 80 مم · إيصال ضيق</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THERMAL_PAPER_SIZES.map((size) => renderPaperSizeButton(size, "thermal"))}
              </div>
            </div>

            <div className="rounded-xl border-2 border-sky-500/40 bg-gradient-to-br from-sky-500/12 via-indigo-600/5 to-transparent p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-500/25 border border-sky-400/30 flex items-center justify-center text-2xl flex-shrink-0">
                  {em.sheet}
                </div>
                <div>
                  <p className="text-sm font-semibold text-sky-100 inline-flex items-center gap-1.5">
                    <span aria-hidden>{em.sheet}</span>
                    ورق عادي
                  </p>
                  <p className="text-xs text-sky-200/60 mt-0.5">A4 و B5 · فاتورة كاملة</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SHEET_PAPER_SIZES.map((size) => renderPaperSizeButton(size, "sheet"))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading emoji={em.invoice}>بيانات رأس الفاتورة</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel emoji={em.branch}>اسم الرأس (اختياري)</FieldLabel>
              <input
                type="text"
                value={settings.headerTitle}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, headerTitle: event.target.value }))
                }
                placeholder={user?.companyName || "اسم المحل"}
                className="glass-input w-full"
              />
              <p className="text-xs text-muted mt-1 inline-flex items-center gap-1.5">
                <span aria-hidden>{em.issue}</span>
                لو فاضي هيظهر اسم الشركة تلقائياً
              </p>
            </div>
            <div>
              <FieldLabel emoji={em.description}>العنوان الفرعي</FieldLabel>
              <input
                type="text"
                value={settings.headerSubtitle}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, headerSubtitle: event.target.value }))
                }
                className="glass-input w-full"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading emoji={em.branch}>محتوى الفاتورة</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-black/20 px-4 py-3 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.showInvoiceNumberOnInvoice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showInvoiceNumberOnInvoice: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-white inline-flex items-center gap-2">
                <span aria-hidden>{em.invoice}</span>
                إظهار رقم الفاتورة
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-black/20 px-4 py-3 cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.showInvoiceCreatorOnInvoice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showInvoiceCreatorOnInvoice: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-white inline-flex items-center gap-2">
                <span aria-hidden>{em.username}</span>
                إظهار حساب من أنشأ الفاتورة
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-black/20 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showBranchPhoneOnInvoice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showBranchPhoneOnInvoice: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-white inline-flex items-center gap-2">
                <span aria-hidden>{em.phone}</span>
                إظهار هاتف الفرع
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-black/20 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showBranchAddressOnInvoice}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showBranchAddressOnInvoice: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm text-white inline-flex items-center gap-2">
                <span aria-hidden>{em.address}</span>
                إظهار عنوان الفرع
              </span>
            </label>
          </div>
          <p className="text-xs text-muted inline-flex items-center gap-1.5">
            <span aria-hidden>{em.issue}</span>
            رقم الفاتورة والحساب في رأس الإيصال · هاتف وعنوان الفرع في رأس الفاتورة
          </p>
        </section>

        <InvoiceContactSettingsPanel settings={settings} onChange={setSettings} />

        <section className="space-y-3">
          <FieldLabel emoji={em.description}>نص أسفل الفاتورة</FieldLabel>
          <textarea
            value={settings.footerText}
            onChange={(event) =>
              setSettings((current) => ({ ...current, footerText: event.target.value }))
            }
            rows={3}
            className="glass-input w-full resize-none"
          />
        </section>

        <section className="space-y-4">
          <SectionHeading emoji={em.product}>جدول الأصناف</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
              <FieldLabel emoji={em.color}>لون هيدر الجدول — A4 / B5</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.sheetTableHeaderColor}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      sheetTableHeaderColor: event.target.value,
                    }))
                  }
                  className="h-10 w-14 rounded-lg border border-sky-500/30 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.sheetTableHeaderColor}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      sheetTableHeaderColor: event.target.value,
                    }))
                  }
                  className="glass-input flex-1 font-mono text-sm"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <FieldLabel emoji={em.color}>لون هيدر الجدول — حراري</FieldLabel>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.thermalTableHeaderColor}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      thermalTableHeaderColor: event.target.value,
                    }))
                  }
                  className="h-10 w-14 rounded-lg border border-amber-500/30 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.thermalTableHeaderColor}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      thermalTableHeaderColor: event.target.value,
                    }))
                  }
                  className="glass-input flex-1 font-mono text-sm"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="w-full max-w-md space-y-1.5">
                <FieldLabel emoji={em.order}>
                  سمك إطار الجدول ({settings.tableBorderWidth}px)
                </FieldLabel>
                <div dir="ltr">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={settings.tableBorderWidth}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        tableBorderWidth: Number(event.target.value),
                      }))
                    }
                    className="block w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted mt-1">
                    <span>1px</span>
                    <span>5px</span>
                  </div>
                </div>
                <p className="text-xs text-muted inline-flex items-center gap-1.5">
                  <span aria-hidden>{em.issue}</span>
                  الإطار الخارجي بالسمك المختار · حدود الخلايا أرفع بـ 1px
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading emoji={em.cycle}>الطباعة التلقائية</SectionHeading>
          <div className="max-w-xs">
            <FieldLabel emoji={em.copies}>عدد النسخ بعد حفظ فاتورة البيع</FieldLabel>
            <input
              type="number"
              min={0}
              max={10}
              value={settings.autoPrintCopies}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  autoPrintCopies: Math.min(10, Math.max(0, Number(event.target.value) || 0)),
                }))
              }
              className="glass-input w-full"
            />
            <p className="text-xs text-muted mt-1 inline-flex items-center gap-1.5">
              <span aria-hidden>{em.quantity}</span>
              0 = بدون طباعة تلقائية · حتى 10 نسخ
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading emoji={em.fontSize}>حجم الخط</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <FieldLabel emoji={em.thermal}>
                الفواتير الحرارية ({settings.thermalFontSize}px)
              </FieldLabel>
              <div dir="ltr">
                <input
                  type="range"
                  min={8}
                  max={16}
                  step={1}
                  value={settings.thermalFontSize}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      thermalFontSize: Number(event.target.value),
                    }))
                  }
                  className="block w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>8</span>
                  <span>16</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
              <FieldLabel emoji={em.sheet}>
                A4 و B5 ({settings.sheetFontSize}px)
              </FieldLabel>
              <div dir="ltr">
                <input
                  type="range"
                  min={10}
                  max={20}
                  step={1}
                  value={settings.sheetFontSize}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      sheetFontSize: Number(event.target.value),
                    }))
                  }
                  className="block w-full accent-sky-500"
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>10</span>
                  <span>20</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-nowrap items-stretch gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary !w-auto inline-flex items-center justify-center gap-2 shrink-0"
          >
            <span>{em.settings}</span>
            {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ إعدادات الطباعة"}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-border text-white hover:bg-white/15 shrink-0"
          >
            <span aria-hidden>{em.search}</span>
            معاينة
          </button>
        </div>
        {saveError ? (
          <p className="text-sm text-red-400 inline-flex items-center gap-1.5">
            <span aria-hidden>{em.warning}</span>
            {saveError}
          </p>
        ) : null}
      </div>
      )}

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        settings={settings}
        context={previewContext}
      />
    </>
  );
}
