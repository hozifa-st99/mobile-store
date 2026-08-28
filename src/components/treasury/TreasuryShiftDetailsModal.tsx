"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { formatAmountExact } from "@/lib/utils";

type ViewMode = "brief" | "full";

interface TreasuryShiftTotalsByType {
  sales: number;
  saleReturns: number;
  purchases: number;
  purchaseReturns: number;
  receivableCollections: number;
  expenseRecovery: number;
  expenses: number;
}

interface TreasuryShiftEntryDetail {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  documentNumber: string;
  description: string;
  date: string;
  paymentMethod: string | null;
  detailUrl: string;
}

interface TreasuryShiftDetails {
  shiftNumber: string;
  closedAt: string;
  userName: string | null;
  netSales: number;
  totalCash: number;
  totalExpenses: number;
  totalIn: number;
  totalOut: number;
  entryCount: number;
  totalsByType: TreasuryShiftTotalsByType;
  entries: TreasuryShiftEntryDetail[];
}

interface TreasuryShiftDetailsModalProps {
  open: boolean;
  shiftId: string | null;
  onClose: () => void;
}

const briefRows = [
  { key: "netSales" as const, label: "إجمالي المبيعات صافي", accent: "text-accent-green" },
  { key: "totalCash" as const, label: "إجمالي النقدية", accent: "text-primary-light" },
  { key: "totalExpenses" as const, label: "إجمالي المصروفات", accent: "text-red-400" },
];

const typeBadgeClass: Record<string, string> = {
  sale: "bg-accent-green/15 text-accent-green border-accent-green/30",
  sale_return: "bg-red-500/15 text-red-400 border-red-500/30",
  purchase: "bg-primary/15 text-primary-light border-primary/30",
  purchase_return: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  purchase_receivable_collection: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  purchase_return_expense_recovery: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  expense: "bg-accent-orange/15 text-accent-orange border-accent-orange/30",
};

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex rounded-xl border border-border/60 bg-background-input/30 p-1">
      <button
        type="button"
        onClick={() => onChange("brief")}
        className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
          mode === "brief"
            ? "bg-primary/20 text-primary-light border border-primary/30"
            : "text-muted hover:text-white"
        }`}
      >
        مختصر
      </button>
      <button
        type="button"
        onClick={() => onChange("full")}
        className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
          mode === "full"
            ? "bg-primary/20 text-primary-light border border-primary/30"
            : "text-muted hover:text-white"
        }`}
      >
        شامل
      </button>
    </div>
  );
}

function ShiftMeta({ details }: { details: TreasuryShiftDetails }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background-input/30 px-4 py-3 space-y-2">
      <div>
        <p className="text-xs text-muted mb-1">تاريخ التقفيل</p>
        <DocumentDateTimeStack value={details.closedAt} />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {details.userName && <span>بواسطة: {details.userName}</span>}
        <span>{details.entryCount} حركة</span>
      </div>
    </div>
  );
}

function BriefView({ details }: { details: TreasuryShiftDetails }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background-input/30 divide-y divide-border/40">
      {briefRows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="text-sm text-muted">{row.label}</span>
          <span className={`text-base font-bold tabular-nums ${row.accent}`}>
            {formatAmountExact(details[row.key])} ج.م
          </span>
        </div>
      ))}
    </div>
  );
}

function buildPlusBreakdown(parts: { label: string; value: number }[]) {
  const active = parts.filter((part) => part.value > 0);
  if (active.length === 0) return "لا توجد حركات";
  return active.map((part) => `${part.label} ${formatAmountExact(part.value)}`).join(" + ");
}

function buildNetCashBreakdown(details: TreasuryShiftDetails) {
  const t = details.totalsByType;
  const inPart = buildPlusBreakdown([
    { label: "مبيعات", value: t.sales },
    { label: "مرتجعات مشتريات", value: t.purchaseReturns },
    { label: "تحصيل مستحقات", value: t.receivableCollections },
    { label: "استرداد مصاريف", value: t.expenseRecovery },
  ]);
  const outPart = buildPlusBreakdown([
    { label: "مرتجعات مبيعات", value: t.saleReturns },
    { label: "مشتريات", value: t.purchases },
    { label: "مصروفات", value: t.expenses },
  ]);

  if (inPart === "لا توجد حركات" && outPart === "لا توجد حركات") {
    return "لا توجد حركات";
  }
  if (outPart === "لا توجد حركات") return inPart;
  if (inPart === "لا توجد حركات") return `− (${outPart})`;
  return `${inPart} − (${outPart})`;
}

function TotalsBreakdownHint({ text }: { text: string }) {
  return <p className="text-[10px] leading-relaxed text-muted mt-1">{text}</p>;
}

type TotalsCellVariant = "default" | "summary" | "total";

function TotalsCell({
  label,
  value,
  accent,
  breakdown,
  variant = "default",
}: {
  label: string;
  value: number;
  accent: string;
  breakdown?: string;
  variant?: TotalsCellVariant;
}) {
  const variantClass =
    variant === "summary"
      ? "border-accent-green/25 bg-accent-green/10"
      : variant === "total"
        ? "border-primary/30 bg-primary/10"
        : "border-border/40 bg-background-input/20";

  return (
    <div className={`rounded-xl px-3 py-2.5 border ${variantClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs text-muted">{label}</span>
          {breakdown ? <TotalsBreakdownHint text={breakdown} /> : null}
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${accent}`}>
          {formatAmountExact(value)} ج.م
        </span>
      </div>
    </div>
  );
}

function FullTotalsSummary({ details }: { details: TreasuryShiftDetails }) {
  const t = details.totalsByType;

  const totalInBreakdown = buildPlusBreakdown([
    { label: "مبيعات", value: t.sales },
    { label: "مرتجعات مشتريات", value: t.purchaseReturns },
    { label: "تحصيل مستحقات", value: t.receivableCollections },
    { label: "استرداد مصاريف", value: t.expenseRecovery },
  ]);

  const totalOutBreakdown = buildPlusBreakdown([
    { label: "مرتجعات مبيعات", value: t.saleReturns },
    { label: "مشتريات", value: t.purchases },
    { label: "مصروفات", value: t.expenses },
  ]);

  const netCashBreakdown = buildNetCashBreakdown(details);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-bold text-white">إجماليات الوردية</p>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <TotalsCell label="مبيعات" value={t.sales} accent="text-accent-green" />
          <TotalsCell label="مرتجعات مبيعات" value={t.saleReturns} accent="text-red-400" />
        </div>

        <TotalsCell
          label="صافي المبيعات"
          value={details.netSales}
          accent="text-accent-green"
          variant="summary"
        />

        <div className="grid grid-cols-2 gap-2">
          <TotalsCell label="مشتريات" value={t.purchases} accent="text-primary-light" />
          <TotalsCell label="مرتجعات مشتريات" value={t.purchaseReturns} accent="text-cyan-300" />
          <TotalsCell label="تحصيل مستحقات" value={t.receivableCollections} accent="text-teal-300" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <TotalsCell
            label="استرداد مصاريف مشتريات"
            value={t.expenseRecovery}
            accent="text-emerald-300"
          />
          <TotalsCell label="مصروفات" value={t.expenses} accent="text-red-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <TotalsCell
            label="إجمالي وارد"
            value={details.totalIn}
            accent="text-accent-green"
            variant="total"
            breakdown={totalInBreakdown}
          />
          <TotalsCell
            label="إجمالي صادر"
            value={details.totalOut}
            accent="text-red-400"
            variant="total"
            breakdown={totalOutBreakdown}
          />
          <TotalsCell
            label="صافي النقدية"
            value={details.totalCash}
            accent="text-primary-light"
            variant="total"
            breakdown={netCashBreakdown}
          />
        </div>
      </div>
    </div>
  );
}

function FullView({ details }: { details: TreasuryShiftDetails }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border/60 overflow-hidden flex flex-col h-[min(44dvh,400px)] min-h-[240px]">
        <div className="px-4 py-2.5 border-b border-border/40 bg-background-input/30 flex-shrink-0">
          <p className="text-xs text-muted">
            {details.entryCount} حركة — مرّر داخل الجدول لعرض الكل
          </p>
        </div>
        <div className="overflow-auto flex-1 min-h-0 overscroll-contain">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-background-input/95 backdrop-blur-sm">
              <tr className="text-xs text-muted-dark border-b border-border">
                <th className="text-right p-3 font-medium">المستند</th>
                <th className="text-right p-3 font-medium">النوع</th>
                <th className="text-right p-3 font-medium">البيان</th>
                <th className="text-right p-3 font-medium">التاريخ</th>
                <th className="text-right p-3 font-medium">المبلغ</th>
                <th className="text-right p-3 font-medium">عرض</th>
              </tr>
            </thead>
            <tbody>
              {details.entries.map((entry) => {
                const badge = typeBadgeClass[entry.type] || "bg-white/10 text-white border-white/10";
                return (
                  <tr key={entry.id} className="border-b border-border/30">
                    <td className="p-3 font-semibold text-primary-light">{entry.documentNumber}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[11px] font-semibold border ${badge}`}>
                        {entry.typeLabel}
                      </span>
                    </td>
                    <td className="p-3 text-muted max-w-[220px] truncate" title={entry.description}>
                      {entry.description}
                    </td>
                    <td className="p-3">
                      <DocumentDateTimeStack value={entry.date} />
                    </td>
                    <td className="p-3">
                      <span
                        className={`font-bold tabular-nums ${
                          entry.direction === "in" ? "text-accent-green" : "text-red-400"
                        }`}
                      >
                        {entry.direction === "in" ? "+" : "−"}
                        {formatAmountExact(entry.amount)} ج.م
                      </span>
                    </td>
                    <td className="p-3">
                      <Link
                        href={entry.detailUrl}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light hover:text-white"
                      >
                        <span>{em.view}</span>
                        فتح
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FullTotalsSummary details={details} />
    </div>
  );
}

export default function TreasuryShiftDetailsModal({
  open,
  shiftId,
  onClose,
}: TreasuryShiftDetailsModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("brief");
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<TreasuryShiftDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setViewMode("brief");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !shiftId) {
      setDetails(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiJson<{ details: TreasuryShiftDetails }>(`/api/treasury/shifts/${shiftId}`)
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.details) {
          setDetails(data.details);
        } else {
          setDetails(null);
          setError("تعذر تحميل تفاصيل الوردية");
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDetails(null);
        setError("تعذر تحميل تفاصيل الوردية");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, shiftId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={details ? `تفاصيل ${details.shiftNumber}` : "تفاصيل الوردية"}
      size={viewMode === "full" ? "lg" : "sm"}
    >
      {loading ? (
        <p className="text-sm text-muted text-center py-8">جاري التحميل...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-8">{error}</p>
      ) : details ? (
        <div className="space-y-4 pb-1">
          <div
            className={
              viewMode === "full"
                ? "space-y-3"
                : "sticky top-0 z-20 -mx-1 px-1 pt-1 pb-3 bg-background-card/95 backdrop-blur-sm space-y-3"
            }
          >
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            <ShiftMeta details={details} />
          </div>
          {viewMode === "brief" ? <BriefView details={details} /> : <FullView details={details} />}
        </div>
      ) : null}
    </Modal>
  );
}
