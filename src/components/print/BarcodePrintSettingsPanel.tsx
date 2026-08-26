"use client";

import { useEffect, useState, type ReactNode } from "react";

import BarcodePrintPreviewModal from "@/components/print/BarcodePrintPreviewModal";
import { em } from "@/components/ui/TableEmoji";
import {
  BARCODE_LABEL_SIZES,
  DEFAULT_BARCODE_PRINT_SETTINGS,
  type BarcodePrintSettings,
} from "@/lib/barcode-print-settings";

function SectionHeading({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2 pb-2 border-b border-border/40 w-full">
      <span aria-hidden>{emoji}</span>
      {children}
    </h2>
  );
}

function ToggleRow({
  emoji,
  title,
  desc,
  checked,
  onChange,
}: {
  emoji: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 text-lg">
          {emoji}
        </div>
        <div>
          <p className="text-sm font-medium text-white inline-flex items-center gap-1.5">
            <span aria-hidden>{emoji}</span>
            {title}
          </p>
          <p className="text-xs text-muted mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? "bg-primary" : "bg-background-input border border-border"
        }`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
            checked ? "left-1" : "right-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function BarcodePrintSettingsPanel() {
  const [settings, setSettings] = useState<BarcodePrintSettings>(DEFAULT_BARCODE_PRINT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch("/api/settings/print-barcode", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
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
      const response = await fetch("/api/settings/print-barcode", {
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
      <div className="space-y-5">
        <section className="space-y-3">
          <SectionHeading emoji={em.product}>محتوى الملصق</SectionHeading>
          <div className="rounded-xl border border-border/50 bg-background-input/20 p-2">
            <ToggleRow
              emoji={em.name}
              title="عرض اسم المنتج"
              desc="يظهر اسم المنتج أعلى الباركود على الملصق"
              checked={settings.showName}
              onChange={(showName) => setSettings((current) => ({ ...current, showName }))}
            />
            <ToggleRow
              emoji={em.salePrice}
              title="عرض سعر البيع"
              desc="يظهر سعر البيع أسفل الباركود على الملصق"
              checked={settings.showPrice}
              onChange={(showPrice) => setSettings((current) => ({ ...current, showPrice }))}
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading emoji={em.serial}>مقاس الملصق</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BARCODE_LABEL_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => setSettings((current) => ({ ...current, labelSize: size.value }))}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors text-start ${
                  settings.labelSize === size.value
                    ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-100"
                    : "border-border bg-background-input/40 text-muted hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>{em.order}</span>
                  {size.label}
                </span>
              </button>
            ))}
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
            {saving ? "جاري الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ إعدادات الباركود"}
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

      <BarcodePrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        settings={settings}
      />
    </>
  );
}
