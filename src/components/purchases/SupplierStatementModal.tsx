"use client";

import Modal from "@/components/ui/Modal";
import { formatDocumentDate, formatDocumentTime } from "@/lib/document-datetime";
import { formatAmountExact, formatCurrency, cn } from "@/lib/utils";

export interface SupplierStatementData {
  supplier: { id: string; nameAr: string; phone: string | null };
  summary: {
    totalCreditPurchases: number;
    totalInvoiceAmount: number;
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
    transactionAmount: number;
    debtDelta: number;
    receivableDelta: number;
    runningDebt: number;
    runningReceivable: number;
    netBalance: number;
    notes: string | null;
    cashPaidAtInvoice?: number;
    creditOpenedAtInvoice?: number;
    invoiceTotal?: number;
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

function formatSignedDelta(value: number, positiveClass: string, negativeClass: string) {
  if (Math.abs(value) <= 0.001) return "—";
  const cls = value > 0 ? positiveClass : negativeClass;
  const prefix = value > 0 ? "+" : "−";
  return (
    <span className={cls}>
      {prefix}
      {formatAmountExact(Math.abs(value))}
    </span>
  );
}

function StatementDebtColumn({
  entry,
}: {
  entry: SupplierStatementData["entries"][number];
}) {
  if (entry.type === "purchase") {
    const cash = entry.cashPaidAtInvoice ?? 0;
    const credit = entry.creditOpenedAtInvoice ?? 0;
    if (cash <= 0.001 && credit <= 0.001) {
      return <span className="text-muted">—</span>;
    }
    return (
      <div className="space-y-1">
        {cash > 0.001 && (
          <p className="text-emerald-300 tabular-nums text-sm">
            <span className="text-[10px] text-emerald-200/70 block">نقد مُسدّد</span>−
            {formatAmountExact(cash)}
          </p>
        )}
        {credit > 0.001 && (
          <p className="text-amber-300 tabular-nums text-sm">
            <span className="text-[10px] text-amber-200/70 block">أجل</span>+
            {formatAmountExact(credit)}
          </p>
        )}
      </div>
    );
  }
  return formatSignedDelta(entry.debtDelta, "text-amber-300", "text-emerald-300");
}

function StatementNetBalance({ value }: { value: number }) {
  if (Math.abs(value) <= 0.001) {
    return <span className="text-emerald-300/90 tabular-nums font-semibold text-sm">متزن</span>;
  }
  const isAlaina = value > 0;
  return (
    <span className={cn("tabular-nums font-semibold", isAlaina ? "text-amber-300" : "text-violet-300")}>
      {formatAmountExact(Math.abs(value))} {isAlaina ? "علينا" : "لنا"}
    </span>
  );
}

function formatTransactionAmount(entry: SupplierStatementData["entries"][number]) {
  if (entry.type === "purchase" && entry.invoiceTotal != null) {
    return (
      <span className="text-white tabular-nums">
        +{formatAmountExact(entry.invoiceTotal)}
      </span>
    );
  }
  return formatSignedDelta(entry.transactionAmount, "text-emerald-300", "text-rose-300");
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
          border: "border-violet-400/40",
          bg: "bg-violet-500/10",
          value: "text-violet-300",
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

  const lastEntry = data?.entries[data.entries.length - 1];

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
              label="إجمالي الفواتير"
              value={`${formatCurrency(data.summary.totalInvoiceAmount)} ج.م`}
              borderClass="border-primary/30"
              bgClass="bg-primary/5"
            />
            <GlassSummaryCard
              emoji="⚠️"
              label="مديونية علينا (حالياً)"
              value={`${formatCurrency(data.summary.debtOutstanding)} ج.م`}
              borderClass="border-amber-400/25"
              bgClass="bg-amber-500/5"
              valueClass="text-amber-300"
            />
            <GlassSummaryCard
              emoji="📥"
              label="مستحقات لنا (حالياً)"
              value={`${formatCurrency(data.summary.receivableOutstanding)} ج.م`}
              borderClass="border-cyan-400/25"
              bgClass="bg-cyan-500/5"
              valueClass="text-cyan-300"
            />
            <GlassSummaryCard
              emoji="💵"
              label="إجمالي المحصّل"
              value={`${formatCurrency(data.summary.totalCollected)} ج.م`}
              borderClass="border-teal-400/25"
              bgClass="bg-teal-500/5"
              valueClass="text-teal-300"
            />
            <GlassSummaryCard
              emoji="💵"
              label="إجمالي المدفوع للمورد"
              value={`${formatCurrency(data.summary.totalPaidOnUs)} ج.م`}
              borderClass="border-emerald-400/25"
              bgClass="bg-emerald-500/5"
              valueClass="text-emerald-300"
            />
            {lastEntry ? (
              <GlassSummaryCard
                emoji="⚖️"
                label="آخر رصيد في الجدول"
                value={`${formatCurrency(Math.abs(lastEntry.netBalance))} ج.م ${lastEntry.netBalance > 0.001 ? "علينا" : lastEntry.netBalance < -0.001 ? "لنا" : ""}`}
                borderClass={netCard.border}
                bgClass={netCard.bg}
                valueClass={netCard.value}
              />
            ) : null}
          </div>

          <p className="text-[11px] text-muted px-1">
            الرصيد = مديونية علينا − مستحقات لنا. توريد الوردية حركة نقدية فقط ولا يغيّر الرصيد.
          </p>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto max-h-[min(28rem,60vh)]">
              <table className="w-full min-w-[980px]">
                <thead className="sticky top-0 z-10 bg-background-input/95 backdrop-blur-md">
                  <tr className="text-xs text-muted-dark border-b border-border">
                    <th className="text-right p-3 font-medium">التاريخ</th>
                    <th className="text-right p-3 font-medium">الحركة</th>
                    <th className="text-right p-3 font-medium">المرجع</th>
                    <th className="text-right p-3 font-medium">تعاملات</th>
                    <th className="text-right p-3 font-medium">⚠️ علينا</th>
                    <th className="text-right p-3 font-medium">📥 لنا</th>
                    <th className="text-right p-3 font-medium">صافي الرصيد</th>
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
                      <td className="p-3 tabular-nums font-medium">
                        {formatTransactionAmount(entry)}
                      </td>
                      <td className="p-3 tabular-nums">
                        <StatementDebtColumn entry={entry} />
                      </td>
                      <td className="p-3 tabular-nums">
                        {formatSignedDelta(
                          entry.receivableDelta,
                          "text-cyan-300",
                          "text-teal-300"
                        )}
                      </td>
                      <td className="p-3 tabular-nums">
                        <StatementNetBalance value={entry.netBalance} />
                      </td>
                      <td className="p-3 text-xs text-muted max-w-[180px]">{entry.notes || "—"}</td>
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
