"use client";

import { useState, type ReactNode } from "react";

import { em } from "@/components/ui/TableEmoji";
import {
  INVOICE_SOCIAL_PLATFORMS,
  createInvoiceContactBranch,
  createInvoiceSocialAccount,
  splitContactPhones,
  type InvoiceContactBranch,
  type InvoiceSocialAccount,
  type PrintSettings,
} from "@/lib/print-settings";

interface InvoiceContactSettingsPanelProps {
  settings: PrintSettings;
  onChange: (next: PrintSettings) => void;
}

type CardTone = "branch" | "social";

const CARD_TONE_STYLES: Record<
  CardTone,
  {
    shell: string;
    badge: string;
    badgeLabel: string;
    badgeEmoji: string;
    divider: string;
    addTone: "emerald" | "fuchsia";
  }
> = {
  branch: {
    shell: "border-emerald-400/35 bg-gradient-to-br from-emerald-500/12 via-teal-500/8 to-transparent",
    badge: "bg-emerald-500/20 text-emerald-100 border-emerald-400/35",
    badgeLabel: "عنوان",
    badgeEmoji: em.address,
    divider: "border-emerald-400/20",
    addTone: "emerald",
  },
  social: {
    shell: "border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-500/12 via-violet-500/8 to-transparent",
    badge: "bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/35",
    badgeLabel: "حساب",
    badgeEmoji: em.link,
    divider: "border-fuchsia-400/20",
    addTone: "fuchsia",
  },
};

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
  tone = "emerald",
}: {
  emoji: string;
  label: string;
  hint: string;
  onClick: () => void;
  tone?: "emerald" | "fuchsia";
}) {
  const toneClasses =
    tone === "fuchsia"
      ? "border-fuchsia-400/45 bg-fuchsia-500/10 hover:border-fuchsia-300/70 hover:bg-fuchsia-500/15 focus-visible:ring-fuchsia-400/50"
      : "border-emerald-400/45 bg-emerald-500/10 hover:border-emerald-300/70 hover:bg-emerald-500/15 focus-visible:ring-emerald-400/50";

  const iconClasses =
    tone === "fuchsia"
      ? "bg-fuchsia-500/20 border-fuchsia-400/30"
      : "bg-emerald-500/20 border-emerald-400/30";

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

function branchSummary(branch: InvoiceContactBranch, index: number): string {
  const address = branch.address.trim();
  const phones = splitContactPhones(branch.phones).join(" · ");
  if (address && phones) return `${address} — ${phones}`;
  if (address) return address;
  if (phones) return phones;
  return `عنوان ${index + 1} — لم يُكتب بعد`;
}

function socialSummary(account: InvoiceSocialAccount): string {
  const platform =
    INVOICE_SOCIAL_PLATFORMS.find((item) => item.value === account.platform)?.label ??
    account.platform;
  const label = account.label.trim();
  if (label) return `${platform}: ${label}`;
  return `${platform} — لم يُكتب بعد`;
}

function CollapsibleContactCard({
  tone,
  summary,
  isOpen,
  onToggle,
  onDelete,
  children,
}: {
  tone: CardTone;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const styles = CARD_TONE_STYLES[tone];

  return (
    <div className={`rounded-xl border overflow-hidden ${styles.shell}`}>
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 flex items-center gap-2 text-right"
          aria-expanded={isOpen}
        >
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
          >
            <span aria-hidden>{styles.badgeEmoji}</span>
            {styles.badgeLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-white/95">{summary}</span>
          <span className="shrink-0 text-xs text-muted" aria-hidden>
            {isOpen ? "▲" : "▼"}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
        >
          <span aria-hidden>{em.edit}</span>
          {isOpen ? "إغلاق" : "تعديل"}
        </button>
      </div>

      {isOpen ? (
        <div className={`space-y-3 border-t px-4 py-4 ${styles.divider}`}>
          {children}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15"
            >
              <span aria-hidden>{em.delete}</span>
              حذف
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function InvoiceContactSettingsPanel({
  settings,
  onChange,
}: InvoiceContactSettingsPanelProps) {
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<string>>(() => new Set());
  const [expandedSocialIds, setExpandedSocialIds] = useState<Set<string>>(() => new Set());

  const toggleBranch = (id: string) => {
    setExpandedBranchIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSocial = (id: string) => {
    setExpandedSocialIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateBranch = (id: string, patch: Partial<{ address: string; phones: string }>) => {
    onChange({
      ...settings,
      invoiceContactBranches: settings.invoiceContactBranches.map((branch) =>
        branch.id === id ? { ...branch, ...patch } : branch
      ),
    });
  };

  const removeBranch = (id: string) => {
    setExpandedBranchIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    onChange({
      ...settings,
      invoiceContactBranches: settings.invoiceContactBranches.filter((branch) => branch.id !== id),
    });
  };

  const updateSocial = (
    id: string,
    patch: Partial<{ platform: InvoiceSocialAccount["platform"]; label: string }>
  ) => {
    onChange({
      ...settings,
      invoiceSocialAccounts: settings.invoiceSocialAccounts.map((account) =>
        account.id === id ? { ...account, ...patch } : account
      ),
    });
  };

  const removeSocial = (id: string) => {
    setExpandedSocialIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    onChange({
      ...settings,
      invoiceSocialAccounts: settings.invoiceSocialAccounts.filter((account) => account.id !== id),
    });
  };

  const addBranch = () => {
    const branch = createInvoiceContactBranch();
    onChange({
      ...settings,
      invoiceContactBranches: [...settings.invoiceContactBranches, branch],
    });
    setExpandedBranchIds((current) => new Set(current).add(branch.id));
  };

  const addSocial = () => {
    const account = createInvoiceSocialAccount();
    onChange({
      ...settings,
      invoiceSocialAccounts: [...settings.invoiceSocialAccounts, account],
    });
    setExpandedSocialIds((current) => new Set(current).add(account.id));
  };

  return (
    <section className="space-y-4">
      <SectionHeading emoji={em.phone}>التواصل وعناوين الفروع</SectionHeading>
      <p className="text-xs text-muted inline-flex items-center gap-1.5">
        <span aria-hidden>{em.issue}</span>
        يظهر أسفل الفاتورة — فوق «شكراً لتعاملكم» · اضغط «تعديل» لفتح أي عنصر ثم احفظ الإعدادات
      </p>

      <div className="space-y-3">
        <FieldLabel emoji={em.address}>
          <span className="inline-flex items-center gap-2">
            عناوين الفروع وأرقام التواصل
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-100">
              أخضر
            </span>
          </span>
        </FieldLabel>
        {settings.invoiceContactBranches.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف عناوين بعد — اضغط الزر بالأسفل للإضافة.</p>
        ) : (
          <div className="space-y-2">
            {settings.invoiceContactBranches.map((branch, index) => (
              <CollapsibleContactCard
                key={branch.id}
                tone="branch"
                summary={branchSummary(branch, index)}
                isOpen={expandedBranchIds.has(branch.id)}
                onToggle={() => toggleBranch(branch.id)}
                onDelete={() => removeBranch(branch.id)}
              >
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
              </CollapsibleContactCard>
            ))}
          </div>
        )}
        <AddActionButton
          emoji={em.branch}
          label="إضافة عنوان / فرع"
          hint={`${em.address} العنوان · ${em.phone} الرقم — سطر واحد: عنوان  رقم  /  عنوان  رقم`}
          tone="emerald"
          onClick={addBranch}
        />
      </div>

      <div className="space-y-3 pt-2">
        <FieldLabel emoji={em.customers}>
          <span className="inline-flex items-center gap-2">
            حسابات التواصل الاجتماعي
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] text-fuchsia-100">
              بنفسجي
            </span>
          </span>
        </FieldLabel>
        {settings.invoiceSocialAccounts.length === 0 ? (
          <p className="text-sm text-muted">لم تُضف حسابات بعد — اضغط الزر بالأسفل للإضافة.</p>
        ) : (
          <div className="space-y-2">
            {settings.invoiceSocialAccounts.map((account) => (
              <CollapsibleContactCard
                key={account.id}
                tone="social"
                summary={socialSummary(account)}
                isOpen={expandedSocialIds.has(account.id)}
                onToggle={() => toggleSocial(account.id)}
                onDelete={() => removeSocial(account.id)}
              >
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
              </CollapsibleContactCard>
            ))}
          </div>
        )}
        <AddActionButton
          emoji={em.customers}
          label="إضافة حساب تواصل اجتماعي"
          hint="📘 فيسبوك · 💬 واتس · 📸 انستجرام · 🎵 تيك توك — تظهر في سطر واحد أسفل العناوين"
          tone="fuchsia"
          onClick={addSocial}
        />
      </div>
    </section>
  );
}
