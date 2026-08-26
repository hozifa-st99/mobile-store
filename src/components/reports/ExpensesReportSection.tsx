"use client";

import { useState } from "react";

import Modal from "@/components/ui/Modal";
import { CellEmoji, em, ThEmoji } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";

interface ExpenseRow {
  category: string;
  amount: number;
}

interface ExpensesReportSectionProps {
  total: number;
  rows: ExpenseRow[];
  categoryLabels: Record<string, string>;
  categoryEmojis: Record<string, string>;
}

export function ReportIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-border/50 bg-white/5 text-base hover:bg-primary/15 hover:border-primary/30 transition-all"
    >
      {em.report}
    </button>
  );
}

export default function ExpensesReportSection({
  total,
  rows,
  categoryLabels,
  categoryEmojis,
}: ExpensesReportSectionProps) {
  const [open, setOpen] = useState(false);

  const enriched = rows
    .map((row) => ({
      ...row,
      label: categoryLabels[row.category] || row.category,
      emoji: categoryEmojis[row.category] || em.category,
      share: total > 0 ? Math.round((row.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topExpense = enriched[0];

  const summaryCards = [
    {
      label: "إجمالي المصروفات",
      value: `${formatCurrency(total)} ج.م`,
      emoji: em.cost,
      cardClass:
        "border-amber-400/40 bg-gradient-to-br from-amber-500/22 via-amber-500/8 to-transparent shadow-[0_10px_28px_rgba(245,158,11,0.14)]",
      valueClass: "text-amber-300",
      emojiClass: "bg-amber-500/22 ring-1 ring-amber-400/25",
    },
    {
      label: "عدد التصنيفات",
      value: String(enriched.length),
      emoji: em.category,
      cardClass:
        "border-indigo-500/35 bg-gradient-to-br from-indigo-500/20 via-indigo-500/6 to-transparent shadow-[0_10px_28px_rgba(99,102,241,0.14)]",
      valueClass: "text-indigo-300",
      emojiClass: "bg-indigo-500/22 ring-1 ring-indigo-400/25",
    },
    {
      label: "أعلى بند",
      value: topExpense ? topExpense.label : "—",
      subValue: topExpense ? `${formatCurrency(topExpense.amount)} ج.م · ${topExpense.share}%` : undefined,
      emoji: topExpense?.emoji || em.profitUp,
      cardClass:
        "border-rose-500/35 bg-gradient-to-br from-rose-500/20 via-rose-500/6 to-transparent shadow-[0_10px_28px_rgba(244,63,94,0.14)]",
      valueClass: "text-rose-300",
      emojiClass: "bg-rose-500/22 ring-1 ring-rose-400/25",
    },
  ];

  return (
    <>
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="section-title inline-flex items-center gap-2">
            <span>{em.cost}</span>
            المصروفات
          </h2>
          <ReportIconButton onClick={() => setOpen(true)} label="تقرير المصروفات" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.cardClass}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white/85">{card.label}</span>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${card.emojiClass}`}
                >
                  {card.emoji}
                </span>
              </div>
              <p className={`mt-3 text-xl font-extrabold leading-snug ${card.valueClass}`}>{card.value}</p>
              {card.subValue && (
                <p className="mt-1.5 text-xs font-semibold text-white/60">{card.subValue}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="تقرير المصروفات" size="lg">
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/18 via-amber-500/5 to-transparent p-4 shadow-[0_8px_24px_rgba(245,158,11,0.12)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white/85">إجمالي المصروفات</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-lg ring-1 ring-amber-400/25">
                {em.cost}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-amber-300 mt-2">{formatCurrency(total)} ج.م</p>
          </div>

          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-border/40 bg-white/[0.02]">
                  <ThEmoji emoji={em.category} className="px-4 py-3 text-start">
                    نوع المصروف
                  </ThEmoji>
                  <ThEmoji emoji={em.cost} className="px-4 py-3 text-start">
                    المبلغ
                  </ThEmoji>
                  <ThEmoji emoji={em.status} className="px-4 py-3 text-start">
                    النسبة
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {enriched.map((row) => (
                  <tr key={row.category} className="border-b border-border/30 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <CellEmoji emoji={row.emoji}>{row.label}</CellEmoji>
                    </td>
                    <td className="px-4 py-3 table-cell-strong">{formatCurrency(row.amount)} ج.م</td>
                    <td className="px-4 py-3 table-cell-strong">{row.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </>
  );
}
