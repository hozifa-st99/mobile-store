"use client";

import Modal from "@/components/ui/Modal";
import { formatDocumentDate, formatDocumentTime } from "@/lib/document-datetime";
import { formatAmountExact, formatCurrency, cn } from "@/lib/utils";

export interface SupplierStatementData {
  supplier: { id: string; nameAr: string; phone: string | null };
  summary: {
    totalCreditPurchases: number;
    totalPaidOnUs: number;
    debtOutstanding: number;
    totalReceivable: number;
    totalCollected: number;
    receivableOutstanding: number;
    netDirection: "linna" | "alaina" | "balanced";
    netAmount: number;
    netLabel: string;
  };
  entries: {
    id: string;
    date: string;
    type: string;
    typeLabel: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
    notes: string | null;
  }[];
}

function GlassSummaryCard({
  emoji,
  label,
  value,
  borderClass,
  bgClass,
  valueClass = "text-white",
}: {
  emoji: string;
  label: string;
  value: string;
  borderClass: string;
  bgClass: string;
  valueClass?: string;
}) {
  return (
    <div className={cn("glass-card p-4 border rounded-2xl", borderClass, bgClass)}>
      <p className="text-xs text-muted mb-1 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className={cn("text-xl font-bold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

export default function SupplierStatementModal({
  open,
  onClose,
  loading,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  data: SupplierStatementData | null;
}) {
  const netCard =
    data?.summary.netDirection === "linna"
      ? {
          border: "border-cyan-400/30",
          bg: "bg-cyan-500/5",
          value: "text-cyan-300",
        }
      : data?.summary.netDirection === "alaina"
        ? {
            border: "border-amber-400/30",
            bg: "bg-amber-500/5",
            value: "text-amber-300",
          }
        : {
            border: "border-emerald-400/30",
            bg: "bg-emerald-500/5",
            value: "text-emerald-300",
          };

  return (
    <Modal open={open} onClose={onClose} title="كشف حساب المورد" size="xl">
      {loading ? (
        <p className="text-sm text-muted py-12 text-center animate-pulse">جاري تحميل الكشف...</p>
      ) : data ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-background-input/20 p-4">
            <p className="text-lg font-bold text-white">{data.supplier.nameAr}</p>
            {data.supplier.phone ? (
              <p className="text-sm text-muted mt-1">{data.supplier.phone}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <GlassSummaryCard
              emoji="🧾"
              label="إجمالي فواتير الأجل"
              value={`${formatCurrency(data.summary.totalCreditPurchases)} ج.م`}
              borderClass="border-primary/30"
              bgClass="bg-primary/5"
            />
            <GlassSummaryCard
              emoji="✅"
              label="المسدّد (علينا)"
              value={`${formatCurrency(data.summary.totalPaidOnUs)} ج.م`}
              borderClass="border-emerald-400/25"
              bgClass="bg-emerald-500/5"
              valueClass="text-emerald-300"
            />
            <GlassSummaryCard
              emoji="⚠️"
              label="مديونية علينا"
              value={`${formatCurrency(data.summary.debtOutstanding)} ج.م`}
              borderClass="border-amber-400/25"
              bgClass="bg-amber-500/5"
              valueClass="text-amber-300"
            />
            <GlassSummaryCard
              emoji="📥"
              label="مستحقات لنا"
              value={`${formatCurrency(data.summary.totalReceivable)} ج.م`}
              borderClass="border-cyan-400/25"
              bgClass="bg-cyan-500/5"
              valueClass="text-cyan-300"
            />
            <GlassSummaryCard
              emoji="💵"
              label="المحصّل"
              value={`${formatCurrency(data.summary.totalCollected)} ج.م`}
              borderClass="border-teal-400/25"
              bgClass="bg-teal-500/5"
              valueClass="text-teal-300"
            />
            <GlassSummaryCard
              emoji={data.summary.netDirection === "linna" ? "🏦" : "📊"}
              label={`صافي الحساب (${data.summary.netLabel})`}
              value={`${formatCurrency(data.summary.netAmount)} ج.م`}
              borderClass={netCard.border}
              bgClass={netCard.bg}
              valueClass={netCard.value}
            />
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto max-h-[min(28rem,60vh)]">
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 z-10 bg-background-input/95 backdrop-blur-md">
                  <tr className="text-xs text-muted-dark border-b border-border">
                    <th className="text-right p-3 font-medium">التاريخ</th>
                    <th className="text-right p-3 font-medium">الحركة</th>
                    <th className="text-right p-3 font-medium">المرجع</th>
                    <th className="text-right p-3 font-medium">علينا</th>
                    <th className="text-right p-3 font-medium">لنا</th>
                    <th className="text-right p-3 font-medium">الرصيد</th>
                    <th className="text-right p-3 font-medium">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                      <td className="p-3 text-sm text-muted leading-snug">
                        <div>{formatDocumentDate(entry.date)}</div>
                        <div className="text-[11px] text-muted-dark tabular-nums">
                          {formatDocumentTime(entry.date)}
                        </div>
                      </td>
                      <td className="p-3 text-sm font-medium">{entry.typeLabel}</td>
                      <td className="p-3 text-sm">{entry.reference}</td>
                      <td className="p-3 tabular-nums text-amber-300">
                        {entry.debit > 0.001 ? formatAmountExact(entry.debit) : "—"}
                      </td>
                      <td className="p-3 tabular-nums text-cyan-300">
                        {entry.credit > 0.001 ? formatAmountExact(entry.credit) : "—"}
                      </td>
                      <td
                        className={cn(
                          "p-3 tabular-nums font-semibold",
                          entry.balance > 0.001
                            ? "text-amber-300"
                            : entry.balance < -0.001
                              ? "text-cyan-300"
                              : "text-muted"
                        )}
                      >
                        {formatAmountExact(Math.abs(entry.balance))}
                        {entry.balance > 0.001 ? " علينا" : entry.balance < -0.001 ? " لنا" : ""}
                      </td>
                      <td className="p-3 text-xs text-muted max-w-[160px]">{entry.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted py-12 text-center">تعذّر تحميل كشف الحساب</p>
      )}
    </Modal>
  );
}
