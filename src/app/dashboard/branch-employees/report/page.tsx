"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import EmployeeSalesDetailModal from "@/components/reports/EmployeeSalesDetailModal";
import ReportDateFilter, { type ReportFilterState } from "@/components/reports/ReportDateFilter";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { appendReportQuery } from "@/lib/report-query";
import { formatCurrency } from "@/lib/utils";

interface EmployeeReportRow {
  id: string;
  employeeCode: string;
  nameAr: string;
  phone?: string | null;
  address?: string | null;
  salesCount: number;
  salesTotal: number;
}

interface ReportData {
  periodLabel: string;
  rows: EmployeeReportRow[];
  totals: { salesCount: number; salesTotal: number };
}

const defaultFilter: ReportFilterState = {
  mode: "preset",
  period: "month",
  month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  from: "",
  to: "",
};

function SummaryCard({
  emoji,
  label,
  value,
  borderClass,
  bgClass,
  valueClass = "text-white",
}: {
  emoji: string;
  label: string;
  value: string | number;
  borderClass: string;
  bgClass: string;
  valueClass?: string;
}) {
  return (
    <div className={`glass-card p-4 border ${borderClass} ${bgClass}`}>
      <p className="text-xs text-muted mb-1 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function BranchEmployeesReportPage() {
  const [filter, setFilter] = useState<ReportFilterState>(defaultFilter);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [detailEmployee, setDetailEmployee] = useState<{ id: string; nameAr: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = appendReportQuery("/api/reports/employees", filter);
    apiJson<ReportData>(url).then(({ ok, data: res }) => {
      if (ok && res) setData(res);
      setLoading(false);
    });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    let rows = data?.rows ?? [];
    if (selectedEmployeeId) {
      rows = rows.filter((row) => row.id === selectedEmployeeId);
    }
    const q = nameSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.nameAr.toLowerCase().includes(q) ||
        row.employeeCode.includes(q) ||
        (row.phone || "").includes(q)
    );
  }, [data?.rows, nameSearch, selectedEmployeeId]);

  const employeeOptions = useMemo(() => {
    return [...(data?.rows ?? [])].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
  }, [data?.rows]);

  const hasActiveFilter = Boolean(selectedEmployeeId || nameSearch.trim());

  const filteredInvoiceCount = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.salesCount, 0),
    [filteredRows]
  );

  const activeEmployees = useMemo(
    () => filteredRows.filter((r) => r.salesCount > 0).length,
    [filteredRows]
  );

  const topPerformer = useMemo(() => {
    if (!filteredRows.length) return null;
    return [...filteredRows].sort((a, b) => b.salesTotal - a.salesTotal)[0];
  }, [filteredRows]);

  return (
    <>
      <PageHeader
        title="تقرير الموظفين"
        subtitle="مبيعات كل موظف خلال الفترة المحددة — للمكافآت والمتابعة"
      />

      <div className="mb-4">
        <Link
          href="/dashboard/branch-employees"
          className="text-sm text-primary-light hover:text-white transition-colors"
        >
          ← العودة للموظفين
        </Link>
      </div>

      <ReportDateFilter
        value={filter}
        onChange={setFilter}
        onApply={load}
        loading={loading}
        rangeLabel={data?.periodLabel}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <SummaryCard
          emoji="🧾"
          label="عدد الفواتير"
          value={loading ? "…" : filteredInvoiceCount}
          borderClass="border-primary/30"
          bgClass="bg-primary/5"
        />
        <SummaryCard
          emoji="👔"
          label="موظفون نشطون"
          value={loading ? "…" : activeEmployees}
          borderClass="border-primary/25"
          bgClass="bg-primary/5"
        />
        <SummaryCard
          emoji="🏆"
          label="الأعلى مبيعاً"
          value={loading ? "…" : topPerformer?.nameAr ?? "—"}
          borderClass="border-accent-orange/25"
          bgClass="bg-accent-orange/5"
          valueClass="text-accent-orange text-lg sm:text-xl"
        />
      </div>

      <div className="glass-card p-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="min-w-[220px] max-w-xs flex-1">
          <label className="text-[11px] text-muted mb-1.5 block inline-flex items-center gap-1.5">
            <span aria-hidden>{em.customer}</span>
            اختيار الموظف
          </label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="glass-input h-12 py-0 w-full text-sm"
          >
            <option value="">كل الموظفين</option>
            {employeeOptions.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} — {emp.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <label className="text-[11px] text-muted mb-1.5 block inline-flex items-center gap-1.5">
            <span aria-hidden>{em.search}</span>
            بحث سريع
          </label>
          <span className="absolute right-3 top-[calc(50%+10px)] -translate-y-1/2 text-muted pointer-events-none" aria-hidden>
            {em.search}
          </span>
          <input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="glass-input h-12 py-0 pr-10 w-full text-sm"
            placeholder="بحث بالاسم أو الرقم أو الهاتف..."
          />
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setSelectedEmployeeId("");
              setNameSearch("");
            }}
            className="h-12 px-4 rounded-xl border border-border text-muted hover:text-white text-sm transition-colors self-end"
          >
            مسح الفلتر
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.number} className="text-right p-4 font-medium w-24">
                  الرقم
                </ThEmoji>
                <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                  الاسم
                </ThEmoji>
                <ThEmoji emoji={em.phone} className="text-center p-4 font-medium">
                  الهاتف
                </ThEmoji>
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  عدد الفواتير
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  إجمالي المبيعات
                </ThEmoji>
                <ThEmoji emoji={em.view} className="text-center p-4 font-medium w-28">
                  تفاصيل
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    {hasActiveFilter
                      ? "لا توجد نتائج مطابقة للفلتر"
                      : "لا يوجد موظفين أو مبيعات في هذه الفترة"}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm font-mono font-bold text-primary-light">{row.employeeCode}</td>
                    <td className="p-4 text-sm font-medium text-white">
                      <CellEmoji emoji={em.customer}>{row.nameAr}</CellEmoji>
                    </td>
                    <td className="p-4 text-sm text-muted text-center">
                      <span className="inline-flex items-center justify-center gap-1.5" dir="ltr">
                        {row.phone ? (
                          <>
                            <span aria-hidden className="opacity-85">{em.phone}</span>
                            <span>{row.phone}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-sm tabular-nums text-white font-semibold">
                      <CellEmoji emoji={em.invoice}>{row.salesCount}</CellEmoji>
                    </td>
                    <td className="p-4 text-sm tabular-nums text-accent-green font-bold">
                      {formatCurrency(row.salesTotal)} ج.م
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setDetailEmployee({ id: row.id, nameAr: row.nameAr })}
                        disabled={row.salesCount === 0}
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold bg-primary/15 text-primary-light border border-primary/30 hover:bg-primary/25 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span aria-hidden>{em.view}</span>
                        تفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeSalesDetailModal
        open={Boolean(detailEmployee)}
        onClose={() => setDetailEmployee(null)}
        employeeId={detailEmployee?.id ?? null}
        employeeName={detailEmployee?.nameAr ?? ""}
        filter={filter}
      />
    </>
  );
}
