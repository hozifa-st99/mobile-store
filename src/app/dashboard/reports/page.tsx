"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import CustomersReportModal from "@/components/reports/CustomersReportModal";
import ExpensesReportSection, { ReportIconButton } from "@/components/reports/ExpensesReportSection";
import InventoryReportModal from "@/components/reports/InventoryReportModal";
import ReportDateFilter, { type ReportFilterState } from "@/components/reports/ReportDateFilter";
import ReportStatCard from "@/components/reports/ReportStatCard";
import ReportsCharts from "@/components/reports/ReportsCharts";
import ReturnsBreakdownInfo from "@/components/reports/ReturnsBreakdownInfo";
import SalesReportsModal from "@/components/reports/SalesReportsModal";
import SuppliersReportModal from "@/components/reports/SuppliersReportModal";
import ProfitBreakdownInfo from "@/components/ui/ProfitBreakdownInfo";
import { em } from "@/components/ui/TableEmoji";
import { buildReportQuery } from "@/lib/report-query";
import { formatCurrency } from "@/lib/utils";

interface ReportData {
  range: { label: string };
  summary: {
    salesGrossTotal: number;
    salesNetTotal: number;
    salesTotal: number;
    salesCount: number;
    salesAvg: number;
    salesDiscount: number;
    purchasesGrossTotal: number;
    purchasesNetTotal: number;
    purchasesTotal: number;
    purchaseReturnsTotal: number;
    purchaseReturnSubtotal: number;
    purchaseExpenseRecovered: number;
    saleReturnsTotal: number;
    saleReturnsCount: number;
    purchaseReturnsCount: number;
    actualCash: number;
    purchasesCount: number;
    expensesTotal: number;
    expensesCount: number;
    maintenanceRevenue: number;
    maintenanceCost: number;
    maintenanceCount: number;
    profit: number;
    profitMargin: number;
    cogsTotal: number;
    cogsGrossTotal: number;
    returnCogsTotal: number;
    cashFlow: number;
    customersCount: number;
    suppliersCount: number;
    stockUnits: number;
  };
  salesByPayment: { method: string; label: string; total: number; count: number }[];
  expensesByCategory: { category: string; amount: number }[];
  salesChart: { label: string; sales: number }[];
  comparisonChart: { name: string; value: number; fill: string }[];
  expenseChart: { name: string; value: number }[];
}

const categoryLabels: Record<string, string> = {
  rent: "إيجار",
  utilities: "مرافق",
  salary: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
};

const categoryEmojis: Record<string, string> = {
  rent: "🏠",
  utilities: "💡",
  salary: "👔",
  marketing: "📣",
  other: "📂",
};

const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

export default function ReportsPage() {
  const [filter, setFilter] = useState<ReportFilterState>({
    mode: "preset",
    period: "month",
    month: defaultMonth,
    from: "",
    to: "",
  });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [salesReportsOpen, setSalesReportsOpen] = useState(false);

  const loadReport = useCallback(async (nextFilter: ReportFilterState) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${buildReportQuery(nextFilter)}`, { credentials: "include" });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(filter);
  }, []);

  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="التقارير والتحليلات"
        subtitle="مركز التقارير الرئيسي — ملخص الأداء المالي والتشغيلي (عرض فقط)"
      />

      <ReportDateFilter
        value={filter}
        onChange={setFilter}
        onApply={() => loadReport(filter)}
        loading={loading}
        rangeLabel={data?.range?.label}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="min-h-[210px] rounded-2xl bg-background-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : s ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <ReportStatCard
              variant="sales"
              title="صافي المبيعات"
              value={formatCurrency(s.salesNetTotal)}
              suffix="ج.م"
              watermark="📈"
              progress={
                s.salesNetTotal > 0
                  ? Math.min(100, Math.round((s.cashFlow / s.salesNetTotal) * 100))
                  : 0
              }
              titleInfo={
                <ReturnsBreakdownInfo
                  total={s.saleReturnsTotal}
                  count={s.saleReturnsCount}
                  label="مرتجعات المبيعات"
                />
              }
              titleAction={
                <ReportIconButton
                  onClick={() => setSalesReportsOpen(true)}
                  label="تقارير المبيعات"
                />
              }
              stats={[
                { label: "عدد الفواتير", value: String(s.salesCount), emoji: em.invoice },
                { label: "متوسط الفاتورة", value: `${formatCurrency(s.salesAvg)} ج.م`, emoji: em.total },
                {
                  label: "مرتجعات المبيعات",
                  value: `${formatCurrency(s.saleReturnsTotal)} ج.م`,
                  emoji: "↩️",
                },
              ]}
            />

            <ReportStatCard
              variant={s.profit >= 0 ? "profit" : "loss"}
              title="صافي الربح"
              value={formatCurrency(s.profit)}
              suffix="ج.م"
              watermark={s.profit >= 0 ? "📈" : "📉"}
              progress={Math.min(100, Math.max(0, s.profitMargin))}
              titleInfo={
                <ProfitBreakdownInfo
                  actualCash={s.actualCash}
                  purchases={s.purchasesNetTotal}
                  saleReturns={s.saleReturnsTotal}
                  purchaseReturnSubtotal={s.purchaseReturnSubtotal}
                  purchaseExpenseRecovered={s.purchaseExpenseRecovered}
                  profit={s.profit}
                  cogs={s.cogsTotal}
                  expenses={s.expensesTotal}
                  sales={s.salesNetTotal}
                  mode="click"
                />
              }
              stats={[
                { label: "هامش الربح", value: `${s.profitMargin}%`, emoji: em.profitUp },
                {
                  label: "تكلفة البضاعة",
                  value: `${formatCurrency(s.cogsTotal)} ج.م`,
                  emoji: em.purchasePrice,
                },
                { label: "المصروفات", value: `${formatCurrency(s.expensesTotal)} ج.م`, emoji: em.cost },
              ]}
            />

            <ReportStatCard
              variant="purchases"
              title="صافي المشتريات"
              value={formatCurrency(s.purchasesNetTotal)}
              suffix="ج.م"
              watermark="🚚"
              titleInfo={
                <ReturnsBreakdownInfo
                  total={s.purchaseReturnsTotal}
                  count={s.purchaseReturnsCount}
                  label="مرتجعات المشتريات"
                />
              }
              stats={[
                { label: "عدد الفواتير", value: String(s.purchasesCount), emoji: em.invoice },
                {
                  label: "إجمالي المشتريات",
                  value: `${formatCurrency(s.purchasesGrossTotal)} ج.م`,
                  emoji: em.product,
                },
                {
                  label: "مرتجعات المشتريات",
                  value: `${formatCurrency(s.purchaseReturnsTotal)} ج.م`,
                  emoji: "↩️",
                },
              ]}
            />

            <ReportStatCard
              variant="expenses"
              title="المصروفات"
              value={formatCurrency(s.expensesTotal)}
              suffix="ج.م"
              watermark="💸"
              stats={[
                { label: "عدد العمليات", value: String(s.expensesCount), emoji: em.number },
                {
                  label: "نسبة من المبيعات",
                  value:
                    s.salesNetTotal > 0
                      ? `${Math.round((s.expensesTotal / s.salesNetTotal) * 100)}%`
                      : "0%",
                  emoji: em.profitDown,
                },
                {
                  label: "التصنيفات",
                  value: String(data?.expensesByCategory?.length || 0),
                  emoji: em.category,
                },
              ]}
            />

            <ReportStatCard
              variant="customers"
              title="العملاء والمخزون"
              value={String(s.customersCount)}
              suffix="عميل"
              watermark="👥"
              stats={[
                {
                  label: "المخزون",
                  value: `${s.stockUnits} وحدة`,
                  emoji: em.product,
                  onClick: () => setInventoryOpen(true),
                },
                {
                  label: "العملاء",
                  value: `${s.customersCount} عميل`,
                  emoji: em.customers,
                  onClick: () => setCustomersOpen(true),
                },
                {
                  label: "الموردين",
                  value: `${s.suppliersCount} مورد`,
                  emoji: em.supplier,
                  onClick: () => setSuppliersOpen(true),
                },
              ]}
            />

            <ReportStatCard
              variant="maintenance"
              title="الصيانة"
              value={formatCurrency(s.maintenanceRevenue)}
              suffix="ج.م"
              watermark="🔧"
              stats={[
                { label: "عدد الطلبات", value: String(s.maintenanceCount), emoji: em.order },
                { label: "تكلفة الصيانة", value: `${formatCurrency(s.maintenanceCost)} ج.م`, emoji: em.cost },
                {
                  label: "صافي الصيانة",
                  value: `${formatCurrency(s.maintenanceRevenue - s.maintenanceCost)} ج.م`,
                  emoji: "⚡",
                },
              ]}
            />
          </div>

          {data?.salesChart && data.comparisonChart && data.expenseChart && (
            <ReportsCharts
              salesChart={data.salesChart}
              comparisonChart={data.comparisonChart}
              expenseChart={data.expenseChart}
            />
          )}

          {data?.salesByPayment && data.salesByPayment.length > 0 && (
            <div className="glass-card p-5 mb-4">
              <h2 className="section-title mb-4 inline-flex items-center gap-2">
                <span>{em.payment}</span>
                المبيعات حسب طريقة الدفع
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.salesByPayment.map((p) => (
                  <div
                    key={p.method}
                    className="rounded-xl border border-border/40 bg-background-card/60 p-4 flex flex-col gap-1"
                  >
                    <span className="text-sm font-bold text-muted">{p.label}</span>
                    <span className="text-lg font-extrabold text-white">{formatCurrency(p.total)} ج.م</span>
                    <span className="text-xs font-semibold text-muted">{p.count} فاتورة</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.expensesByCategory && (
            <ExpensesReportSection
              total={s.expensesTotal}
              rows={data.expensesByCategory}
              categoryLabels={categoryLabels}
              categoryEmojis={categoryEmojis}
            />
          )}
        </>
      ) : (
        <div className="glass-card p-12 text-center text-muted font-semibold">
          لا توجد بيانات للتقرير
        </div>
      )}

      <InventoryReportModal open={inventoryOpen} onClose={() => setInventoryOpen(false)} />
      <CustomersReportModal open={customersOpen} onClose={() => setCustomersOpen(false)} filter={filter} />
      <SuppliersReportModal open={suppliersOpen} onClose={() => setSuppliersOpen(false)} filter={filter} />
      <SalesReportsModal
        open={salesReportsOpen}
        onClose={() => setSalesReportsOpen(false)}
        filter={filter}
        salesSummary={
          s
            ? {
                grossTotal: s.salesGrossTotal,
                returnsTotal: s.saleReturnsTotal,
                netTotal: s.salesNetTotal,
              }
            : undefined
        }
      />
    </>
  );
}
