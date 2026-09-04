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
        يظهر أسفل الفاتورة مباشرةً — فوق نص «شكراً لتعاملكم» — في A4 / B5 والحراري
      </p>

      <div className="space-y-3">
        <FieldLabel emoji={em.address}>عناوين الفروع وأرقام التواصل</FieldLabel>
        {settings.invoiceContactBranches.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف عناوين بعد.</p>
        ) : (
          <div className="space-y-3">
            {settings.invoiceContactBranches.map((branch, index) => (
              <div
                key={branch.id}
                className="rounded-xl border border-border/60 bg-black/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">عنوان {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeBranch(branch.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    حذف
                  </button>
                </div>
                <textarea
                  value={branch.address}
                  onChange={(event) => updateBranch(branch.id, { address: event.target.value })}
                  rows={2}
                  placeholder="عنوان الفرع"
                  className="glass-input w-full resize-none"
                />
                <textarea
                  value={branch.phones}
                  onChange={(event) => updateBranch(branch.id, { phones: event.target.value })}
                  rows={2}
                  placeholder="أرقام التواصل — افصل بينها بفاصلة أو سطر جديد"
                  className="glass-input w-full resize-none"
                  dir="ltr"
                />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...settings,
              invoiceContactBranches: [
                ...settings.invoiceContactBranches,
                createInvoiceContactBranch(),
              ],
            })
          }
          className="glass-btn-secondary text-sm px-4 py-2"
        >
          + إضافة عنوان / فرع
        </button>
      </div>

      <div className="space-y-3 pt-2">
        <FieldLabel emoji={em.customers}>حسابات التواصل الاجتماعي</FieldLabel>
        {settings.invoiceSocialAccounts.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف حسابات بعد.</p>
        ) : (
          <div className="space-y-3">
            {settings.invoiceSocialAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-xl border border-border/60 bg-black/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">حساب تواصل</p>
                  <button
                    type="button"
                    onClick={() => removeSocial(account.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
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
        <button
          type="button"
          onClick={() =>
            onChange({
              ...settings,
              invoiceSocialAccounts: [
                ...settings.invoiceSocialAccounts,
                createInvoiceSocialAccount(),
              ],
            })
          }
          className="glass-btn-secondary text-sm px-4 py-2"
        >
          + إضافة فيسبوك / واتس / انستجرام / تيك توك
        </button>
      </div>
    </section>
  );
}
