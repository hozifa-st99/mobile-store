"use client";

import type { ReactNode } from "react";

import { em } from "@/components/ui/TableEmoji";
import {
  INVOICE_SOCIAL_PLATFORMS,
  createInvoiceContactBranch,
  createInvoiceSocialAccount,
  type PrintSettings,
} from "@/lib/print-settings";

interface InvoiceContactSettingsPanelProps {
  settings: PrintSettings;
  onChange: (next: PrintSettings) => void;
}

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

function AddActionButton({
  emoji,
  label,
  hint,
  onClick,
  tone = "sky",
}: {
  emoji: string;
  label: string;
  hint: string;
  onClick: () => void;
  tone?: "sky" | "violet";
}) {
  const toneClasses =
    tone === "violet"
      ? "border-violet-400/45 bg-violet-500/10 hover:border-violet-300/70 hover:bg-violet-500/15 focus-visible:ring-violet-400/50"
      : "border-sky-400/45 bg-sky-500/10 hover:border-sky-300/70 hover:bg-sky-500/15 focus-visible:ring-sky-400/50";

  const iconClasses =
    tone === "violet"
      ? "bg-violet-500/20 border-violet-400/30"
      : "bg-sky-500/20 border-sky-400/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 ${toneClasses}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl shadow-inner border transition-transform group-hover:scale-105 ${iconClasses}`}
        aria-hidden
      >
        {emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <span aria-hidden>{em.add}</span>
          {label}
        </span>
        <span className="text-xs text-muted leading-relaxed">{hint}</span>
      </span>
    </button>
  );
}

export default function InvoiceContactSettingsPanel({
  settings,
  onChange,
}: InvoiceContactSettingsPanelProps) {
  const updateBranch = (id: string, patch: Partial<{ address: string; phones: string }>) => {
    onChange({
      ...settings,
      invoiceContactBranches: settings.invoiceContactBranches.map((branch) =>
        branch.id === id ? { ...branch, ...patch } : branch
      ),
    });
  };

  const removeBranch = (id: string) => {
    onChange({
      ...settings,
      invoiceContactBranches: settings.invoiceContactBranches.filter((branch) => branch.id !== id),
    });
  };

  const updateSocial = (
    id: string,
    patch: Partial<{ platform: PrintSettings["invoiceSocialAccounts"][number]["platform"]; label: string }>
  ) => {
    onChange({
      ...settings,
      invoiceSocialAccounts: settings.invoiceSocialAccounts.map((account) =>
        account.id === id ? { ...account, ...patch } : account
      ),
    });
  };

  const removeSocial = (id: string) => {
    onChange({
      ...settings,
      invoiceSocialAccounts: settings.invoiceSocialAccounts.filter((account) => account.id !== id),
    });
  };

  return (
    <section className="space-y-4">
      <SectionHeading emoji={em.phone}>التواصل وعناوين الفروع</SectionHeading>
      <p className="text-xs text-muted inline-flex items-center gap-1.5">
        <span aria-hidden>{em.issue}</span>
        يظهر أسفل الفاتورة — فوق «شكراً لتعاملكم» · عدّل أي بيانات ثم اضغط «حفظ إعدادات الطباعة»
      </p>

      <div className="space-y-3">
        <FieldLabel emoji={em.address}>عناوين الفروع وأرقام التواصل</FieldLabel>
        {settings.invoiceContactBranches.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف عناوين بعد — اضغط الزر بالأسفل للإضافة.</p>
        ) : (
          <div className="space-y-3">
            {settings.invoiceContactBranches.map((branch, index) => (
              <div
                key={branch.id}
                className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white inline-flex items-center gap-2">
                    <span aria-hidden>{em.edit}</span>
                    تعديل عنوان {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeBranch(branch.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200"
                  >
                    <span aria-hidden>{em.delete}</span>
                    حذف
                  </button>
                </div>
                <div>
                  <FieldLabel emoji={em.address}>العنوان</FieldLabel>
                  <textarea
                    value={branch.address}
                    onChange={(event) => updateBranch(branch.id, { address: event.target.value })}
                    rows={2}
                    placeholder="عنوان الفرع"
                    className="glass-input w-full resize-none"
                  />
                </div>
                <div>
                  <FieldLabel emoji={em.phone}>أرقام التواصل</FieldLabel>
                  <textarea
                    value={branch.phones}
                    onChange={(event) => updateBranch(branch.id, { phones: event.target.value })}
                    rows={2}
                    placeholder="أرقام التواصل — افصل بينها بفاصلة أو سطر جديد"
                    className="glass-input w-full resize-none"
                    dir="ltr"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <AddActionButton
          emoji={em.branch}
          label="إضافة عنوان / فرع"
          hint={`${em.address} العنوان · ${em.phone} الرقم — سطر واحد: عنوان  رقم  ,  عنوان  رقم`}
          onClick={() =>
            onChange({
              ...settings,
              invoiceContactBranches: [
                ...settings.invoiceContactBranches,
                createInvoiceContactBranch(),
              ],
            })
          }
        />
      </div>

      <div className="space-y-3 pt-2">
        <FieldLabel emoji={em.customers}>حسابات التواصل الاجتماعي</FieldLabel>
        {settings.invoiceSocialAccounts.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف حسابات بعد — اضغط الزر بالأسفل للإضافة.</p>
        ) : (
          <div className="space-y-3">
            {settings.invoiceSocialAccounts.map((account, index) => (
              <div
                key={account.id}
                className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white inline-flex items-center gap-2">
                    <span aria-hidden>{em.edit}</span>
                    تعديل حساب {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeSocial(account.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200"
                  >
                    <span aria-hidden>{em.delete}</span>
                    حذف
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel emoji={em.type}>المنصة</FieldLabel>
                    <select
                      value={account.platform}
                      onChange={(event) =>
                        updateSocial(account.id, {
                          platform: event.target.value as typeof account.platform,
                        })
                      }
                      className="glass-input w-full"
                    >
                      {INVOICE_SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform.value} value={platform.value}>
                          {platform.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel emoji={em.name}>اسم الصفحة / الحساب</FieldLabel>
                    <input
                      type="text"
                      value={account.label}
                      onChange={(event) => updateSocial(account.id, { label: event.target.value })}
                      placeholder="مثال: Mobile Store Egypt"
                      className="glass-input w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <AddActionButton
          emoji={em.customers}
          label="إضافة حساب تواصل اجتماعي"
          hint="📘 فيسبوك · 💬 واتس · 📸 انستجرام · 🎵 تيك توك — تظهر في سطر واحد أسفل العناوين"
          tone="violet"
          onClick={() =>
            onChange({
              ...settings,
              invoiceSocialAccounts: [
                ...settings.invoiceSocialAccounts,
                createInvoiceSocialAccount(),
              ],
            })
          }
        />
      </div>
    </section>
  );
}
