"use client";

import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { CellEmoji, em, ThEmoji } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";
import { ReportIconButton } from "@/components/reports/ExpensesReportSection";

export interface BelowCostReportPayload {
  summary: {
    totalLoss: number;
    saleLineCount: number;
    returnLineCount: number;
    segments: {
      segment: "phone" | "accessory";
      label: string;
      loss: number;
      lineCount: number;
    }[];
  };
  details: {
    id: string;
    segment: "phone" | "accessory";
    description: string;
    quantity: number;
    netRevenue: number;
    lineCost: number;
    loss: number;
    invoiceNumber: string;
    documentDate: string;
    kind: "sale" | "return";
  }[];
}

function formatDocDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function BelowCostSalesReportSection({ data }: { data: BelowCostReportPayload }) {
  const [open, setOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<"all" | "phone" | "accessory">("all");

  const { summary, details } = data;
  const phone = summary.segments.find((s) => s.segment === "phone");
  const accessory = summary.segments.find((s) => s.segment === "accessory");

  const filteredDetails = useMemo(() => {
    if (segmentFilter === "all") return details;
    return details.filter((d) => d.segment === segmentFilter);
  }, [details, segmentFilter]);

  const summaryCards = [
    {
      label: "إجمالي الخسارة (تحت التكلفة)",
      value: `${formatCurrency(summary.totalLoss)} ج.م`,
      emoji: "📉",
      cardClass:
        "border-rose-500/40 bg-gradient-to-br from-rose-500/22 via-rose-500/8 to-transparent shadow-[0_10px_28px_rgba(244,63,94,0.14)]",
      valueClass: "text-rose-300",
      emojiClass: "bg-rose-500/22 ring-1 ring-rose-400/25",
      subValue:
        summary.saleLineCount > 0 || summary.returnLineCount > 0
          ? `${summary.saleLineCount} سطر بيع · ${summary.returnLineCount} مرتجع مخصوم`
          : "لا أسطر تحت التكلفة في الفترة",
    },
    {
      label: "موبايلات",
      value: `${formatCurrency(phone?.loss ?? 0)} ج.م`,
      emoji: "📱",
      cardClass:
        "border-cyan-500/35 bg-gradient-to-br from-cyan-500/20 via-cyan-500/6 to-transparent shadow-[0_10px_28px_rgba(6,182,212,0.14)]",
      valueClass: "text-cyan-300",
      emojiClass: "bg-cyan-500/22 ring-1 ring-cyan-400/25",
      subValue: phone?.lineCount ? `${phone.lineCount} سطر` : undefined,
    },
    {
      label: "إكسسوارات",
      value: `${formatCurrency(accessory?.loss ?? 0)} ج.م`,
      emoji: "🎧",
      cardClass:
        "border-violet-500/35 bg-gradient-to-br from-violet-500/20 via-violet-500/6 to-transparent shadow-[0_10px_28px_rgba(139,92,246,0.14)]",
      valueClass: "text-violet-300",
      emojiClass: "bg-violet-500/22 ring-1 ring-violet-400/25",
      subValue: accessory?.lineCount ? `${accessory.lineCount} سطر` : undefined,
    },
  ];

  return (
    <>
      <div className="glass-card p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="section-title inline-flex items-center gap-2">
            <span>📉</span>
            مبيعات تحت التكلفة (بعد الخصم)
          </h2>
          <ReportIconButton onClick={() => setOpen(true)} label="تفاصيل مبيعات تحت التكلفة" />
        </div>
        <p className="text-xs font-semibold text-muted mb-4">
          عرض تحليلي مستقل — لا يغيّر صافي الربح أو باقي التقرير
        </p>
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

      <Modal open={open} onClose={() => setOpen(false)} title="مبيعات تحت التكلفة — التفاصيل" size="xl">
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-400/35 bg-gradient-to-br from-rose-500/18 via-rose-500/5 to-transparent p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white/85">إجمالي الخسارة في الفترة</span>
              <span className="text-2xl font-extrabold text-rose-300">{formatCurrency(summary.totalLoss)} ج.م</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "الكل" },
                { key: "phone", label: "موبايلات" },
                { key: "accessory", label: "إكسسوارات" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSegmentFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${
                  segmentFilter === tab.key
                    ? "border-primary/50 bg-primary/20 text-white"
                    : "border-border/50 bg-white/5 text-muted hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredDetails.length === 0 ? (
            <p className="text-center text-muted font-semibold py-8">لا توجد أسطر تحت التكلفة في هذه الفترة</p>
          ) : (
            <div className="rounded-2xl border border-border/40 overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-border/40 bg-white/[0.02]">
                    <ThEmoji emoji={em.product} className="px-3 py-3 text-start">
                      الصنف
                    </ThEmoji>
                    <ThEmoji emoji={em.number} className="px-3 py-3 text-start">
                      كمية
                    </ThEmoji>
                    <ThEmoji emoji={em.purchasePrice} className="px-3 py-3 text-start">
                      تكلفة
                    </ThEmoji>
                    <ThEmoji emoji={em.total} className="px-3 py-3 text-start">
                      صافي بيع
                    </ThEmoji>
                    <ThEmoji emoji="📉" className="px-3 py-3 text-start">
                      خسارة
                    </ThEmoji>
                    <ThEmoji emoji={em.invoice} className="px-3 py-3 text-start">
                      مستند
                    </ThEmoji>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((row) => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <CellEmoji emoji={row.segment === "phone" ? "📱" : "🎧"}>
                          <span className="block max-w-[200px] truncate" title={row.description}>
                            {row.description}
                          </span>
                          <span className="text-[11px] font-semibold text-muted">
                            {row.kind === "return" ? "مرتجع" : "بيع"}
                          </span>
                        </CellEmoji>
                      </td>
                      <td className="px-3 py-2.5 table-cell-strong">{row.quantity}</td>
                      <td className="px-3 py-2.5 table-cell-strong">{formatCurrency(row.lineCost)} ج.م</td>
                      <td className="px-3 py-2.5 table-cell-strong">{formatCurrency(row.netRevenue)} ج.م</td>
                      <td
                        className={`px-3 py-2.5 table-cell-strong ${
                          row.loss < 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {formatCurrency(row.loss)} ج.م
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="table-cell-strong block">{row.invoiceNumber}</span>
                        <span className="text-[11px] font-semibold text-muted">{formatDocDate(row.documentDate)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}