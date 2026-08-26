"use client";

import { useCallback, useEffect, useState } from "react";

import KpiCard from "@/components/dashboard/KpiCard";
import PageHeader from "@/components/layout/PageHeader";
import ReportDateFilter, { type ReportFilterState } from "@/components/reports/ReportDateFilter";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import TreasuryShiftDetailsModal from "@/components/treasury/TreasuryShiftDetailsModal";
import { apiJson } from "@/lib/api-client";
import { formatAmountExact } from "@/lib/utils";

interface TreasuryShiftRow {
  id: string;
  shiftNumber: string;
  closedAt: string;
  totalIn: number;
  totalOut: number;
  netAmount: number;
  entryCount: number;
  userName: string | null;
}

interface DepositsData {
  range: { label: string };
  shifts: TreasuryShiftRow[];
  summary: {
    count: number;
    totalIn: number;
    totalOut: number;
    netAmount: number;
  };
}

const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function buildQuery(filter: ReportFilterState) {
  const params = new URLSearchParams();
  if (filter.mode === "preset") {
    params.set("period", filter.period);
  } else if (filter.mode === "month") {
    params.set("month", filter.month || defaultMonth);
  } else if (filter.from && filter.to) {
    params.set("from", filter.from);
    params.set("to", filter.to);
  }
  return params.toString();
}

export default function TreasuryDepositsPage() {
  const [filter, setFilter] = useState<ReportFilterState>({
    mode: "preset",
    period: "month",
    month: defaultMonth,
    from: "",
    to: "",
  });
  const [data, setData] = useState<DepositsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsShiftId, setDetailsShiftId] = useState<string | null>(null);

  const load = useCallback(async (nextFilter: ReportFilterState) => {
    setLoading(true);
    const { ok, data: json } = await apiJson<DepositsData>(`/api/treasury/shifts?${buildQuery(nextFilter)}`);
    if (ok) setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(filter);
  }, []);

  const summary = data?.summary ?? { count: 0, totalIn: 0, totalOut: 0, netAmount: 0 };
  const shifts = data?.shifts ?? [];

  return (
    <>
      <PageHeader
        title="سجل التوريدات السابقة"
        subtitle="كل ورديات الخزنة المقفولة — مع إمكانية التصفية بالفترة"
      />

      <ReportDateFilter
        value={filter}
        onChange={setFilter}
        onApply={() => load(filter)}
        loading={loading}
        rangeLabel={data?.range?.label}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          variant="invoices"
          delay={0}
          title="عدد التوريدات"
          value={summary.count}
          subtitle="وردية مقفولة"
          emoji="📋"
        />
        <KpiCard
          variant="sales"
          delay={80}
          title="إجمالي وارد"
          value={summary.totalIn}
          suffix="ج.م"
          emoji="💰"
        />
        <KpiCard
          variant="expenses"
          delay={160}
          title="إجمالي صادر"
          value={summary.totalOut}
          suffix="ج.م"
          emoji="💸"
        />
        <KpiCard
          variant={summary.netAmount >= 0 ? "profit" : "loss"}
          delay={240}
          title="صافي التوريدات"
          value={summary.netAmount}
          suffix="ج.م"
          emoji={summary.netAmount >= 0 ? "📈" : "📉"}
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الوردية
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  تاريخ التقفيل
                </ThEmoji>
                <th className="text-right p-4 font-medium">عدد الحركات</th>
                <ThEmoji emoji="💰" className="text-right p-4 font-medium">
                  وارد
                </ThEmoji>
                <ThEmoji emoji="💸" className="text-right p-4 font-medium">
                  صادر
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  صافي التوريد
                </ThEmoji>
                <th className="text-right p-4 font-medium">بواسطة</th>
                <ThEmoji emoji={em.view} className="text-right p-4 font-medium">
                  تفاصيل
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted text-sm">
                    جاري التحميل...
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted text-sm">
                    لا توجد توريدات في هذه الفترة
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="p-4 text-sm font-semibold text-primary-light">{shift.shiftNumber}</td>
                    <td className="p-4">
                      <DocumentDateTimeStack value={shift.closedAt} />
                    </td>
                    <td className="p-4 text-sm text-white tabular-nums">{shift.entryCount}</td>
                    <td className="p-4 text-sm font-bold text-accent-green tabular-nums">
                      {formatAmountExact(shift.totalIn)} ج.م
                    </td>
                    <td className="p-4 text-sm font-bold text-red-400 tabular-nums">
                      {formatAmountExact(shift.totalOut)} ج.م
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          shift.netAmount >= 0 ? "text-accent-green" : "text-red-400"
                        }`}
                      >
                        {formatAmountExact(shift.netAmount)} ج.م
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted">{shift.userName || "—"}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setDetailsShiftId(shift.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-primary/40 bg-primary/15 text-primary-light hover:bg-primary/25"
                      >
                        <span>{em.view}</span>
                        عرض التفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && shifts.length > 0 && (
          <p className="p-3 text-xs text-muted border-t border-border/40">
            {shifts.length} توريد — مرتّب من الأحدث
          </p>
        )}
      </div>

      <TreasuryShiftDetailsModal
        open={detailsShiftId !== null}
        shiftId={detailsShiftId}
        onClose={() => setDetailsShiftId(null)}
      />
    </>
  );
}
