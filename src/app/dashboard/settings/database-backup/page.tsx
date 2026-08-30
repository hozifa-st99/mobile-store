"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import { RESTORE_CONFIRMATION_TEXT } from "@/lib/database-backup-constants";
import { toast } from "@/lib/toast";
import { useScreenAccess } from "@/hooks/use-screen-access";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب`;
}

export default function DatabaseBackupSettingsPage() {
  const { isSuperAdmin } = useScreenAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const canRestore =
    Boolean(selectedFile) &&
    acknowledged &&
    confirmation.trim() === RESTORE_CONFIRMATION_TEXT &&
    !restoring;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/settings/database-backup", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "تعذر إنشاء النسخة الاحتياطية");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || `mobile-store-backup-${Date.now()}.dump`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success(`تم تنزيل النسخة الاحتياطية (${formatBytes(blob.size)})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تنزيل النسخة الاحتياطية");
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile || !canRestore) return;

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("confirmation", confirmation.trim());

      const response = await fetch("/api/settings/database-backup", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "تعذرت استعادة النسخة الاحتياطية");
      }

      toast.success(data.message || "تمت الاستعادة بنجاح");
      setSelectedFile(null);
      setConfirmation("");
      setAcknowledged(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت استعادة النسخة الاحتياطية");
    } finally {
      setRestoring(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="النسخ الاحتياطي" subtitle="نسخ واستعادة قاعدة البيانات" />
        <div className="glass-card p-8 text-center text-muted">
          هذه الشاشة متاحة للسوبر أدمن فقط.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="النسخ الاحتياطي"
        subtitle="نسخة كاملة من قاعدة البيانات — تنزيل واستعادة"
      />

      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="text-sm text-primary-light hover:text-white transition-colors"
        >
          ← العودة للإعدادات
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="glass-card p-6 border border-accent-cyan/25 bg-accent-cyan/5">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-12 h-12 rounded-xl bg-accent-cyan/15 flex items-center justify-center text-2xl" aria-hidden>
              💾
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">تنزيل نسخة احتياطية</h2>
              <p className="text-sm text-muted mt-1">
                نسخة شاملة من كل البيانات: فواتير، مخزون، منتجات، مستخدمين، إعدادات، وتصنيفات.
              </p>
            </div>
          </div>

          <ul className="text-sm text-muted space-y-2 mb-5 list-disc list-inside">
            <li>الملف بصيغة PostgreSQL الاحترافية (.dump)</li>
            <li>يُحفظ على جهازك (اللاب توب) مباشرة</li>
            <li>يُفضّل أخذ نسخة قبل أي استعادة أو تحديث كبير</li>
          </ul>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || restoring}
            className="w-full h-12 rounded-xl font-bold bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/35 hover:bg-accent-cyan/30 transition-colors disabled:opacity-50"
          >
            {downloading ? "جاري إنشاء النسخة..." : "تنزيل نسخة احتياطية كاملة"}
          </button>
        </section>

        <section className="glass-card p-6 border border-accent-orange/25 bg-accent-orange/5">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-12 h-12 rounded-xl bg-accent-orange/15 flex items-center justify-center text-2xl" aria-hidden>
              📤
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">استعادة نسخة احتياطية</h2>
              <p className="text-sm text-muted mt-1">
                ارفع ملف .dump تم تنزيله من هنا ليستبدل بيانات السيرفر بالكامل.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 mb-4">
            <p className="font-bold mb-1">تحذير</p>
            <p>
              الاستعادة تحذف البيانات الحالية على السيرفر وتستبدلها بالنسخة المرفوعة. لا يمكن
              التراجع بعد التأكيد.
            </p>
          </div>

          <label className="block mb-4">
            <span className="text-sm text-muted mb-2 block">ملف النسخة (.dump)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dump,application/octet-stream"
              disabled={restoring}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/20 file:px-4 file:py-2 file:text-primary-light file:font-semibold hover:file:bg-primary/30"
            />
            {selectedFile && (
              <p className="text-xs text-muted mt-2">
                {selectedFile.name} — {formatBytes(selectedFile.size)}
              </p>
            )}
          </label>

          <label className="flex items-start gap-2 text-sm text-muted mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={restoring}
              className="mt-1"
            />
            <span>أفهم أن الاستعادة ستحذف كل البيانات الحالية على السيرفر وتستبدلها بالنسخة المرفوعة.</span>
          </label>

          <label className="block mb-4">
            <span className="text-sm text-muted mb-2 block">
              للتأكيد اكتب: <span className="text-white font-bold">{RESTORE_CONFIRMATION_TEXT}</span>
            </span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={restoring}
              placeholder={RESTORE_CONFIRMATION_TEXT}
              className="w-full rounded-xl border border-border bg-background-input px-4 py-2.5 text-sm text-white outline-none focus:border-accent-orange/50"
            />
          </label>

          <button
            type="button"
            onClick={handleRestore}
            disabled={!canRestore}
            className="w-full h-12 rounded-xl font-bold bg-accent-orange/20 text-accent-orange border border-accent-orange/35 hover:bg-accent-orange/30 transition-colors disabled:opacity-50"
          >
            {restoring ? "جاري الاستعادة..." : "رفع واستعادة النسخة"}
          </button>
        </section>
      </div>

      <section className="glass-card p-5 mt-4 border border-border/60">
        <h3 className="text-sm font-bold text-white mb-2">ملاحظات تقنية</h3>
        <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
          <li>النسخة تشمل كل جداول قاعدة البيانات حرفياً.</li>
          <li>يجب أن يكون على السيرفر pg_dump و pg_restore (أدوات PostgreSQL).</li>
          <li>يُفضّل إيقاف عمل الموظفين أثناء الاستعادة ثم إعادة تحميل الصفحة بعدها.</li>
        </ul>
      </section>
    </>
  );
}
