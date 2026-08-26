"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import KpiCard from "@/components/dashboard/KpiCard";
import PageHeader from "@/components/layout/PageHeader";
import BranchComparisonFilter, {
  buildBranchComparisonQuery,
  createDefaultBranchComparisonFilter,
  defaultBranchComparisonFilter,
  type BranchComparisonFilterState,
} from "@/components/branch-comparison/BranchComparisonFilter";
import BranchMetricCard, { BranchMetricRow, branchNameColorClass } from "@/components/branch-comparison/BranchMetricCard";
import BranchInventoryDetailModal, {
  type BranchInventoryDetailFilter,
} from "@/components/branch-comparison/BranchInventoryDetailModal";
import {
  BRANCH_COMPARISON_SECTIONS,
  type BranchComparisonSectionId,
} from "@/components/branch-comparison/BranchComparisonReportsModal";
import { em } from "@/components/ui/TableEmoji";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const TimelineChart = dynamic(
  () => import("@/components/branch-comparison/BranchComparisonTimelineChart"),
  { ssr: false, loading: () => <div className="h-72 glass-card animate-pulse rounded-2xl" /> }
);

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

interface ComparisonRow {
  branchId: string;
  branchName: string;
  summary: {
    salesGrossTotal: number;
    salesNetTotal: number;
    salesCount: number;
    salesAvg: number;
    salesDiscount: number;
    saleReturnsTotal: number;
    saleReturnsCount: number;
    saleReturnsRate: number;
    purchasesGrossTotal: number;
    purchasesNetTotal: number;
    purchasesCount: number;
    purchaseReturnsTotal: number;
    purchaseReturnsCount: number;
    cogsTotal: number;
    grossProfit: number;
    grossProfitMargin: number;
    expensesTotal: number;
    expensesToSalesRatio: number;
    profit: number;
    profitMargin: number;
    actualCash: number;
    customersInSales: number;
  };
  inventory: {
    stockValue: number;
    unitCount: number;
    skuCount: number;
    phoneStockValue: number;
    accessoryStockValue: number;
    lowCount: number;
    outCount: number;
    stagnantCount: number;
    fastMovingCount: number;
    currentStockMovementRate: number;
    avgStockValue: number;
    inventoryTurnoverRate: number;
    avgDaysInStock: number | null;
    inventoryEfficiency: number;
    items: {
      productId: string;
      name: string;
      barcode: string | null;
      typeLabel: string;
      category: string;
      quantity: number;
      minQuantity: number;
      unitCost: number;
      stockValue: number;
      status: "out" | "low" | "stagnant" | "fast";
    }[];
  };
  stocktake: {
    count: number;
    surplusValue: number;
    shortageValue: number;
    netAdjustment: number;
    itemsWithVariance: number;
    missingImeiCount: number;
    phoneShortageValue: number;
    accessoryShortageValue: number;
  };
  phones: {
    soldCount: number;
    soldByBrand: { brand: string; count: number }[];
    availableCount: number;
    usedStockCount: number;
    phoneStockValue: number;
    phoneSales: number;
    phoneProfit: number;
    returnedCount: number;
    usedCount: number;
  };
  employees: {
    employeeCount: number;
    salesTotal: number;
    salesPerEmployee: number;
  };
  expensesByCategory: { category: string; amount: number }[];
  topByQuantity: { productId: string; name: string; quantity: number; sales: number; profit: number }[];
  topBySales: { productId: string; name: string; quantity: number; sales: number; profit: number }[];
  topByProfit: { productId: string; name: string; quantity: number; sales: number; profit: number }[];
  stagnantProducts: { productId: string; name: string; quantity: number; sales: number; profit: number }[];
  timeSeries: { label: string; sales: number }[];
}

interface PerformanceScore {
  overall: number;
  sales: number;
  profitability: number;
  inventory: number;
  expenses: number;
  returns: number;
  insufficientData?: boolean;
  weights: Record<string, number>;
  reasons: string[];
}

function formatDaysInStock(days: number | null) {
  if (days === null || days <= 0) return "— (لا توجد مبيعات بعد)";
  return `${days} يوم`;
}

interface ApiResponse {
  range: { label: string; periodDays?: number };
  compareRange: { mode: string } | null;
  branches: { id: string; name: string }[];
  rows: ComparisonRow[];
  compareByBranchId: Record<string, ComparisonRow> | null;
  performanceScores: Record<string, PerformanceScore>;
  bestBranchId: string | null;
  productComparison: {
    productId: string;
    name: string;
    branches: {
      branchId: string;
      branchName: string;
      quantity: number;
      sales: number;
      profit: number;
      stockQty: number;
    }[];
  }[];
}

function ChangeBadge({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        up ? "text-emerald-400" : "text-rose-400"
      )}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function CollapsibleSection({
  id,
  title,
  emoji,
  open,
  onToggle,
  children,
}: {
  id: BranchComparisonSectionId;
  title: string;
  emoji: string;
  open: boolean;
  onToggle: (id: BranchComparisonSectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="glass-card overflow-hidden mb-4 branch-comparison-section">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-right hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xl shrink-0" aria-hidden>
          {emoji}
        </span>
        <span className="flex-1 text-base sm:text-lg font-extrabold text-white">{title}</span>
        <span className="text-muted text-sm font-bold">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-border/30">{children}</div> : null}
    </section>
  );
}

function BestCell({
  value,
  best,
  format = "money",
}: {
  value: number;
  best: number;
  format?: "money" | "number" | "percent";
}) {
  const isBest = value === best && best !== 0;
  const text =
    format === "money"
      ? formatCurrency(value)
      : format === "percent"
        ? `${value}%`
        : formatNumber(value);
  return (
    <td className={cn("px-3 py-2.5 text-sm font-semibold tabular-nums", isBest && "bc-best-cell")}>
      {text}
      {isBest && <span className="bc-best-badge ms-1">★</span>}
    </td>
  );
}

interface BranchComparisonDashboardProps {
  initialSection?: BranchComparisonSectionId | null;
}

export default function BranchComparisonDashboard({
  initialSection = null,
}: BranchComparisonDashboardProps) {
  const [filter, setFilter] = useState<BranchComparisonFilterState>(defaultBranchComparisonFilter);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [chartBranches, setChartBranches] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<BranchComparisonSectionId | null>(
    initialSection ?? "overview"
  );
  const [inventoryDetail, setInventoryDetail] = useState<{
    branchName: string;
    filter: BranchInventoryDetailFilter;
    items: ComparisonRow["inventory"]["items"];
  } | null>(null);
  const scrolledRef = useRef(false);

  const toggleSection = (id: BranchComparisonSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const load = useCallback(async (nextFilter: BranchComparisonFilterState, search?: string) => {
    setLoading(true);
    try {
      let q = buildBranchComparisonQuery(nextFilter);
      if (search?.trim()) q += `&productSearch=${encodeURIComponent(search.trim())}`;
      const res = await fetch(`/api/reports/branch-comparison?${q}`, { credentials: "include" });
      const json = await res.json();
      setData(json);
      if (!chartBranches.length && json.rows?.length) {
        setChartBranches(json.rows.slice(0, 2).map((r: ComparisonRow) => r.branchId));
      }
    } finally {
      setLoading(false);
    }
  }, [chartBranches.length]);

  const resetFilter = useCallback(() => {
    const next = createDefaultBranchComparisonFilter();
    setFilter(next);
    setProductSearch("");
    void load(next);
  }, [load]);

  const openInventoryDetail = (
    branchName: string,
    filter: BranchInventoryDetailFilter,
    items: ComparisonRow["inventory"]["items"]
  ) => {
    setInventoryDetail({ branchName, filter, items });
  };

  useEffect(() => {
    load(filter);
  }, []);

  useEffect(() => {
    if (initialSection) setOpenSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!initialSection || scrolledRef.current || loading) return;
    scrolledRef.current = true;
    const el = document.getElementById(initialSection);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialSection, loading]);

  const rows = data?.rows ?? [];
  const periodDays = data?.range?.periodDays ?? 30;
  const compareMap = data?.compareByBranchId ?? {};
  const bestBranch = rows.find((r) => r.branchId === data?.bestBranchId);
  const bestScore = data?.bestBranchId ? data.performanceScores[data.bestBranchId] : null;

  const tableMetrics = useMemo(
    () => [
      { key: "salesGross", label: "المبيعات", get: (r: ComparisonRow) => r.summary.salesGrossTotal, higher: true, fmt: "money" as const },
      { key: "salesNet", label: "صافي المبيعات", get: (r: ComparisonRow) => r.summary.salesNetTotal, higher: true, fmt: "money" as const },
      { key: "salesCount", label: "عدد الفواتير", get: (r: ComparisonRow) => r.summary.salesCount, higher: true, fmt: "number" as const },
      { key: "salesAvg", label: "متوسط الفاتورة", get: (r: ComparisonRow) => r.summary.salesAvg, higher: true, fmt: "money" as const },
      { key: "cogs", label: "تكلفة المبيعات", get: (r: ComparisonRow) => r.summary.cogsTotal, higher: false, fmt: "money" as const },
      { key: "grossProfit", label: "مجمل الربح", get: (r: ComparisonRow) => r.summary.grossProfit, higher: true, fmt: "money" as const },
      { key: "grossMargin", label: "هامش الربح", get: (r: ComparisonRow) => r.summary.grossProfitMargin, higher: true, fmt: "percent" as const },
      { key: "profit", label: "صافي الربح", get: (r: ComparisonRow) => r.summary.profit, higher: true, fmt: "money" as const },
      { key: "purchases", label: "المشتريات", get: (r: ComparisonRow) => r.summary.purchasesNetTotal, higher: false, fmt: "money" as const },
      { key: "expenses", label: "المصروفات", get: (r: ComparisonRow) => r.summary.expensesTotal, higher: false, fmt: "money" as const },
      { key: "stock", label: "قيمة المخزون", get: (r: ComparisonRow) => r.inventory.stockValue, higher: false, fmt: "money" as const },
      { key: "turnover", label: "معدل دوران المخزون", get: (r: ComparisonRow) => r.inventory.inventoryTurnoverRate, higher: true, fmt: "number" as const },
      { key: "returns", label: "المرتجعات", get: (r: ComparisonRow) => r.summary.saleReturnsTotal, higher: false, fmt: "money" as const },
      { key: "returnRate", label: "نسبة المرتجعات", get: (r: ComparisonRow) => r.summary.saleReturnsRate, higher: false, fmt: "percent" as const },
      { key: "stocktake", label: "فرق الجرد", get: (r: ComparisonRow) => r.stocktake.netAdjustment, higher: true, fmt: "money" as const },
      { key: "cash", label: "رصيد الخزنة", get: (r: ComparisonRow) => r.summary.actualCash, higher: true, fmt: "money" as const },
    ],
    []
  );

  const sectionProps = (id: BranchComparisonSectionId) => ({
    id,
    open: openSection === id,
    onToggle: toggleSection,
  });

  return (
    <>
      <PageHeader
        title="🏆 مقارنة أداء الفروع"
        subtitle="لوحة تحكم إدارية — مقارنة شاملة بين فروع المحل (عرض فقط)"
        hideMobileMenu
        centerAction={
          <Link href="/branches" className="bc-back-link">
            <span aria-hidden>{em.branch}</span>
            العودة للفروع
          </Link>
        }
      />

      <BranchComparisonFilter
        value={filter}
        branches={data?.branches ?? []}
        onChange={setFilter}
        onApply={() => load(filter, productSearch)}
        onReset={resetFilter}
        loading={loading}
        rangeLabel={data?.range?.label}
      />

      {loading ? (
        <div className="glass-card p-12 sm:p-16 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden />
          <p className="text-base sm:text-lg font-extrabold text-white">جاري تحميل وإنشاء التقارير…</p>
          <p className="text-sm text-muted font-semibold">قد يستغرق الأمر لحظات حسب عدد الفروع والفترة المحددة</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted font-semibold">لا توجد بيانات للفروع المحددة</div>
      ) : (
        <>
          <CollapsibleSection
            {...sectionProps("overview")}
            title="🏆 أفضل فرع"
            emoji="🏆"
          >
            {bestBranch && bestScore && !bestScore.insufficientData ? (
              <div className="space-y-4">
                <div className="bc-hero-card rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-amber-200/80 font-bold mb-1">أفضل فرع — مؤشر الأداء العام</p>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{bestBranch.branchName}</h2>
                      <p className="text-sm text-muted mt-2 max-w-xl">
                        الدرجة: {bestScore.overall}/100 — ترتيب نسبي بين الفروع النشطة في نفس الفترة (ليس تقييمًا مطلقًا).
                        تُحسب من: المبيعات ({bestScore.weights.sales}%)،
                        الربحية ({bestScore.weights.profitability}%)، المخزون ({bestScore.weights.inventory}%)،
                        المصروفات ({bestScore.weights.expenses}%)، المرتجعات ({bestScore.weights.returns}%)
                      </p>
                      {bestScore.reasons.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {bestScore.reasons.map((r) => (
                            <li key={r} className="text-xs font-semibold text-emerald-300/90">
                              • {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="bc-score-ring shrink-0">
                      <span className="text-3xl font-extrabold text-amber-300">{bestScore.overall}</span>
                      <span className="text-xs text-muted">/100</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <KpiCard compact title="المبيعات" value={bestBranch.summary.salesNetTotal} suffix="ج.م" variant="sales" emoji={em.total} />
                  <KpiCard compact title="صافي الربح" value={bestBranch.summary.profit} suffix="ج.م" variant="profit" emoji={em.profitUp} />
                  <KpiCard compact title="هامش الربح" value={`${bestBranch.summary.profitMargin}%`} variant="profit" emoji="📊" />
                  <KpiCard compact title="عدد الفواتير" value={bestBranch.summary.salesCount} variant="customers" emoji={em.invoice} />
                  <KpiCard compact title="متوسط الفاتورة" value={bestBranch.summary.salesAvg} suffix="ج.م" variant="sales" emoji={em.total} />
                  <KpiCard compact title="معدل دوران المخزون" value={bestBranch.inventory.inventoryTurnoverRate} variant="purchases" emoji="🔄" />
                  <KpiCard compact title="المصروفات" value={bestBranch.summary.expensesTotal} suffix="ج.م" variant="expenses" emoji={em.cost} />
                  <KpiCard
                    compact
                    title="نسبة المصروفات"
                    value={`${bestBranch.summary.expensesToSalesRatio}%`}
                    variant="expenses"
                    emoji="📉"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-5 text-center">
                <p className="text-sm font-bold text-amber-200">لا يمكن تحديد أفضل فرع حالياً</p>
                <p className="text-xs text-muted mt-2">لا توجد مبيعات أو نشاط كافٍ في الفترة المحددة — جرّب فترة أخرى أو انتظر تسجيل عمليات البيع.</p>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            {...sectionProps("comparison-table")}
            title="📊 مقارنة شاملة بين الفروع"
            emoji="📊"
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[640px] bc-table">
                <thead>
                  <tr>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted">المؤشر</th>
                    {rows.map((r, idx) => (
                      <th
                        key={r.branchId}
                        className={cn(
                          "text-right px-3 py-2 text-xs font-extrabold",
                          branchNameColorClass(idx)
                        )}
                      >
                        {r.branchName}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 text-xs font-bold text-amber-300">الأفضل</th>
                  </tr>
                </thead>
                <tbody>
                  {tableMetrics.map((m) => {
                    const values = rows.map((r) => m.get(r));
                    const best = m.higher ? Math.max(...values) : Math.min(...values.filter((v) => v > 0).concat([0]));
                    const bestBranchIdx = rows.findIndex((r) => m.get(r) === best);
                    const bestBranchName = bestBranchIdx >= 0 ? rows[bestBranchIdx].branchName : "—";
                    return (
                      <tr key={m.key} className="border-t border-border/20">
                        <td className="px-3 py-2.5 text-sm font-bold text-muted">{m.label}</td>
                        {rows.map((r) => (
                          <BestCell key={r.branchId} value={m.get(r)} best={best} format={m.fmt} />
                        ))}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-xs font-extrabold",
                            bestBranchIdx >= 0 ? branchNameColorClass(bestBranchIdx) : "text-muted"
                          )}
                        >
                          {bestBranchName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("sales")} title="📈 المبيعات حسب الفرع" emoji="📈">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => {
                const prev = compareMap[r.branchId]?.summary;
                return (
                  <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="📈">
                    <BranchMetricRow emoji={em.total} label="إجمالي المبيعات" value={`${formatCurrency(r.summary.salesGrossTotal)} ج.م`} />
                    <BranchMetricRow
                      emoji={em.profitUp}
                      label="صافي المبيعات"
                      value={
                        <>
                          {formatCurrency(r.summary.salesNetTotal)} ج.م{" "}
                          <ChangeBadge current={r.summary.salesNetTotal} previous={prev?.salesNetTotal} />
                        </>
                      }
                    />
                    <BranchMetricRow emoji={em.invoice} label="عدد الفواتير" value={formatNumber(r.summary.salesCount)} />
                    <BranchMetricRow emoji={em.total} label="متوسط الفاتورة" value={`${formatCurrency(r.summary.salesAvg)} ج.م`} />
                    <BranchMetricRow emoji="🏷️" label="الخصومات" value={`${formatCurrency(r.summary.salesDiscount)} ج.م`} />
                    <BranchMetricRow emoji="↩️" label="مرتجعات المبيعات" value={`${formatCurrency(r.summary.saleReturnsTotal)} ج.م`} />
                  </BranchMetricCard>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("profits")} title="💰 أرباح الفروع" emoji="💰">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => {
                const prev = compareMap[r.branchId]?.summary;
                return (
                  <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="💰">
                    <BranchMetricRow emoji={em.profitUp} label="صافي المبيعات" value={`${formatCurrency(r.summary.salesNetTotal)} ج.م`} />
                    <BranchMetricRow emoji={em.purchasePrice} label="تكلفة البضاعة" value={`${formatCurrency(r.summary.cogsTotal)} ج.م`} />
                    <BranchMetricRow emoji="📊" label="مجمل الربح" value={`${formatCurrency(r.summary.grossProfit)} ج.م`} />
                    <BranchMetricRow emoji={em.cost} label="المصروفات" value={`${formatCurrency(r.summary.expensesTotal)} ج.م`} />
                    <BranchMetricRow
                      emoji={em.profitUp}
                      label="صافي الربح"
                      value={
                        <>
                          {formatCurrency(r.summary.profit)} ج.م{" "}
                          <ChangeBadge current={r.summary.profit} previous={prev?.profit} />
                        </>
                      }
                    />
                    <BranchMetricRow emoji="📈" label="هامش الربح %" value={`${r.summary.profitMargin}%`} />
                  </BranchMetricCard>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("purchases")} title="📦 مشتريات الفروع" emoji="📦">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="📦">
                  <BranchMetricRow emoji={em.product} label="إجمالي المشتريات" value={`${formatCurrency(r.summary.purchasesGrossTotal)} ج.م`} />
                  <BranchMetricRow emoji={em.purchasePrice} label="صافي المشتريات" value={`${formatCurrency(r.summary.purchasesNetTotal)} ج.م`} />
                  <BranchMetricRow emoji={em.invoice} label="عدد فواتير المشتريات" value={formatNumber(r.summary.purchasesCount)} />
                  <BranchMetricRow emoji="↩️" label="مرتجعات المشتريات" value={`${formatCurrency(r.summary.purchaseReturnsTotal)} ج.م`} />
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("inventory")} title="📦 أداء المخزون" emoji={em.product}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji={em.product}>
                  <BranchMetricRow emoji="💰" label="قيمة المخزون" value={`${formatCurrency(r.inventory.stockValue)} ج.م`} />
                  <BranchMetricRow emoji={em.quantity} label="عدد الوحدات" value={formatNumber(r.inventory.unitCount)} />
                  <BranchMetricRow emoji={em.product} label="عدد الأصناف" value={formatNumber(r.inventory.skuCount)} />
                  <BranchMetricRow emoji="📱" label="قيمة الموبايلات" value={`${formatCurrency(r.inventory.phoneStockValue)} ج.م`} />
                  <BranchMetricRow emoji="🎧" label="قيمة الإكسسوارات" value={`${formatCurrency(r.inventory.accessoryStockValue)} ج.م`} />
                  <BranchMetricRow emoji={em.warning} label="أصناف نافدة" value={formatNumber(r.inventory.outCount)} clickable={r.inventory.outCount > 0} onValueClick={() => openInventoryDetail(r.branchName, "out", r.inventory.items ?? [])} />
                  <BranchMetricRow emoji={em.minQuantity} label="تحت الحد الأدنى" value={formatNumber(r.inventory.lowCount)} clickable={r.inventory.lowCount > 0} onValueClick={() => openInventoryDetail(r.branchName, "low", r.inventory.items ?? [])} />
                  <BranchMetricRow emoji="🐢" label="أصناف راكدة" value={formatNumber(r.inventory.stagnantCount)} clickable={r.inventory.stagnantCount > 0} onValueClick={() => openInventoryDetail(r.branchName, "stagnant", r.inventory.items ?? [])} />
                  <BranchMetricRow emoji="⚡" label="سريعة الحركة" value={formatNumber(r.inventory.fastMovingCount)} clickable={r.inventory.fastMovingCount > 0} onValueClick={() => openInventoryDetail(r.branchName, "fast", r.inventory.items ?? [])} />
                  {r.inventory.stockValue > r.summary.salesNetTotal * 0.8 && r.inventory.currentStockMovementRate < 1 ? (
                    <p className="mt-3 text-xs font-bold text-amber-100 bg-black/20 rounded-lg px-3 py-2">
                      ⚠️ مخزون مرتفع مع حركة بيع ضعيفة
                    </p>
                  ) : null}
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("turnover")} title="🔄 دوران المخزون" emoji="🔄">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="🔄">
                  <BranchMetricRow emoji={em.purchasePrice} label="تكلفة البضاعة المباعة" value={`${formatCurrency(r.summary.cogsTotal)} ج.م`} />
                  <BranchMetricRow emoji="📦" label="قيمة المخزون الحالية" value={`${formatCurrency(r.inventory.stockValue)} ج.م`} />
                  <BranchMetricRow emoji={em.cycle} label="معدل حركة المخزون الحالي" value={r.inventory.currentStockMovementRate > 0 ? `${r.inventory.currentStockMovementRate}×` : "—"} />
                  <BranchMetricRow emoji={em.cycle} label="معدل دوران المخزون" value={r.inventory.inventoryTurnoverRate > 0 ? `${r.inventory.inventoryTurnoverRate}×` : "—"} />
                  <BranchMetricRow emoji={em.date} label="متوسط أيام البقاء" value={formatDaysInStock(r.inventory.avgDaysInStock)} />
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("products")} title="🏆 المنتجات الأكثر مبيعًا" emoji="🏆">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="🏆">
                  <div className="pb-3 border-b border-white/10">
                    <p className="text-xs font-bold text-white/70 mb-2">📊 الأكثر مبيعًا (كمية)</p>
                    <ol className="text-sm space-y-1">
                      {r.topByQuantity.slice(0, 10).map((p, i) => (
                        <li key={p.productId} className="flex justify-between gap-2 text-white/90">
                          <span className="truncate">{i + 1}. {p.name}</span>
                          <span className="font-bold tabular-nums shrink-0">{p.quantity}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="pt-3">
                    <p className="text-xs font-bold text-white/70 mb-2">💰 الأكثر ربحًا</p>
                    <ol className="text-sm space-y-1">
                      {r.topByProfit.slice(0, 5).map((p, i) => (
                        <li key={`${p.productId}-p`} className="flex justify-between gap-2 text-white/90">
                          <span className="truncate">{i + 1}. {p.name}</span>
                          <span className="font-bold tabular-nums shrink-0">{formatCurrency(p.profit)} ج.م</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("product-cross")} title="🔀 مقارنة نفس المنتج بين الفروع" emoji="🔀">
            <div className="flex gap-2 mb-4">
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="بحث عن منتج…"
                className="glass-input flex-1 max-w-md"
              />
              <button type="button" onClick={() => load(filter, productSearch)} className="btn-secondary">
                بحث
              </button>
            </div>
            {(data?.productComparison ?? []).length === 0 ? (
              <p className="text-sm text-muted">لا توجد منتجات مشتركة بين فروع متعددة في هذه الفترة</p>
            ) : (
              <div className="space-y-4">
                {data!.productComparison.slice(0, 10).map((p) => (
                  <div key={p.productId} className="bc-branch-card rounded-xl p-4">
                    <h4 className="font-extrabold text-white mb-3">{p.name}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead>
                          <tr className="text-muted text-xs">
                            <th className="text-right py-2">الفرع</th>
                            <th className="text-right py-2">الكمية</th>
                            <th className="text-right py-2">المبيعات</th>
                            <th className="text-right py-2">الربح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.branches.map((b) => (
                            <tr key={b.branchId} className="border-t border-border/20">
                              <td className="py-2 font-bold">{b.branchName}</td>
                              <td className="py-2 tabular-nums">{b.quantity}</td>
                              <td className="py-2 tabular-nums">{formatCurrency(b.sales)} ج.م</td>
                              <td className="py-2 tabular-nums text-emerald-300">{formatCurrency(b.profit)} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("returns")} title="🔄 المرتجعات" emoji="↩️">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => {
                const avgReturn = rows.reduce((s, x) => s + x.summary.saleReturnsRate, 0) / rows.length;
                const alert = r.summary.saleReturnsRate > avgReturn * 1.5 && r.summary.saleReturnsRate > 5;
                return (
                  <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="↩️">
                    <BranchMetricRow emoji="↩️" label="مرتجعات المبيعات" value={`${formatCurrency(r.summary.saleReturnsTotal)} ج.م`} />
                    <BranchMetricRow emoji={em.number} label="عدد المرتجعات" value={formatNumber(r.summary.saleReturnsCount)} />
                    <BranchMetricRow emoji="📊" label="نسبة المرتجعات" value={`${r.summary.saleReturnsRate}%`} />
                    <BranchMetricRow emoji="📦" label="مرتجعات المشتريات" value={`${formatCurrency(r.summary.purchaseReturnsTotal)} ج.م`} />
                    {alert ? (
                      <p className="mt-3 text-xs font-bold text-rose-100 bg-black/20 rounded-lg px-3 py-2">
                        ⚠️ نسبة مرتجعات أعلى من المتوسط
                      </p>
                    ) : null}
                  </BranchMetricCard>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("expenses")} title="💸 المصروفات" emoji="💸">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="💸">
                  <div className="mb-3 flex justify-end">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-black/20 border border-white/10">
                      {r.summary.expensesToSalesRatio}% من المبيعات
                    </span>
                  </div>
                  {r.expensesByCategory.map((e) => (
                    <BranchMetricRow
                      key={e.category}
                      emoji={categoryEmojis[e.category] || "📂"}
                      label={categoryLabels[e.category] || e.category}
                      value={`${formatCurrency(e.amount)} ج.م`}
                    />
                  ))}
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("stocktake")} title="📋 الجرد والتسويات" emoji="📋">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="📋">
                  <BranchMetricRow emoji={em.order} label="عدد عمليات الجرد" value={formatNumber(r.stocktake.count)} />
                  <BranchMetricRow emoji="➕" label="قيمة الزيادة" value={`${formatCurrency(r.stocktake.surplusValue)} ج.م`} />
                  <BranchMetricRow emoji="➖" label="قيمة النقص" value={`${formatCurrency(r.stocktake.shortageValue)} ج.م`} />
                  <BranchMetricRow emoji="📊" label="صافي فرق الجرد" value={`${formatCurrency(r.stocktake.netAdjustment)} ج.م`} />
                  <BranchMetricRow emoji={em.product} label="أصناف بفروق" value={formatNumber(r.stocktake.itemsWithVariance)} />
                  <BranchMetricRow emoji={em.imei} label="موبايلات مفقودة IMEI" value={formatNumber(r.stocktake.missingImeiCount)} />
                  <BranchMetricRow emoji="📱" label="نقص الموبايلات" value={`${formatCurrency(r.stocktake.phoneShortageValue)} ج.م`} />
                  <BranchMetricRow emoji="🎧" label="نقص الإكسسوارات" value={`${formatCurrency(r.stocktake.accessoryShortageValue)} ج.م`} />
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("phones")} title="📱 أداء الموبايلات" emoji="📱">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => (
                <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="📱">
                  <BranchMetricRow emoji={em.device} label="أجهزة مباعة" value={formatNumber(r.phones.soldCount)} />
                  <BranchMetricRow emoji="📲" label="أجهزة متاحة (إجمالي)" value={formatNumber(r.phones.availableCount)} />
                  <BranchMetricRow emoji="♻️" label="مستعمل متاح (المخزون)" value={formatNumber(r.phones.usedStockCount)} />
                  <BranchMetricRow emoji="💰" label="قيمة مخزون الموبايلات" value={`${formatCurrency(r.phones.phoneStockValue)} ج.م`} />
                  <BranchMetricRow emoji={em.total} label="مبيعات الموبايلات" value={`${formatCurrency(r.phones.phoneSales)} ج.م`} />
                  <BranchMetricRow emoji={em.profitUp} label="أرباح الموبايلات" value={`${formatCurrency(r.phones.phoneProfit)} ج.م`} />
                  <BranchMetricRow emoji="↩️" label="مرتجعة" value={formatNumber(r.phones.returnedCount)} />
                  <BranchMetricRow
                    emoji="🔄"
                    label="أجهزة لها أكثر من دورة"
                    value={formatNumber(r.phones.usedCount)}
                  />
                  {r.phones.soldByBrand.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-white/15 space-y-1">
                      <p className="text-xs font-bold mb-2 opacity-90">🏭 حسب الشركة</p>
                      {r.phones.soldByBrand.slice(0, 5).map((b) => (
                        <BranchMetricRow key={b.brand} label={b.brand} value={formatNumber(b.count)} />
                      ))}
                    </div>
                  ) : null}
                </BranchMetricCard>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("kpi")} title="⚡ كفاءة الفرع — KPI" emoji="⚡">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => {
                const kpis = [
                  { label: "متوسط المبيعات اليومية", value: formatCurrency(r.summary.salesNetTotal / periodDays), tip: "صافي المبيعات ÷ أيام الفترة" },
                  { label: "متوسط الفاتورة", value: `${formatCurrency(r.summary.salesAvg)} ج.م`, tip: "متوسط إجمالي الفاتورة من قاعدة البيانات" },
                  { label: "متوسط إنفاق العميل", value: r.summary.customersInSales > 0 ? `${formatCurrency(r.summary.salesNetTotal / r.summary.customersInSales)} ج.م` : "—", tip: "صافي المبيعات ÷ عدد العملاء المسجّلين" },
                  { label: "هامش الربح", value: `${r.summary.grossProfitMargin}%`, tip: "مجمل الربح ÷ صافي المبيعات × 100" },
                  { label: "نسبة المصروفات", value: `${r.summary.expensesToSalesRatio}%`, tip: "المصروفات ÷ صافي المبيعات × 100" },
                  { label: "معدل حركة المخزون الحالي", value: r.inventory.currentStockMovementRate > 0 ? `${r.inventory.currentStockMovementRate}×` : "—", tip: "تكلفة البضاعة ÷ قيمة المخزون الحالية" },
                  { label: "معدل دوران المخزون", value: r.inventory.inventoryTurnoverRate > 0 ? `${r.inventory.inventoryTurnoverRate}×` : "—", tip: "تكلفة البضاعة ÷ متوسط قيمة المخزون" },
                  { label: "نسبة المرتجعات", value: `${r.summary.saleReturnsRate}%`, tip: "قيمة المرتجعات ÷ إجمالي المبيعات × 100" },
                  { label: "كفاءة المخزون", value: r.inventory.inventoryEfficiency > 0 ? `${r.inventory.inventoryEfficiency}×` : "—", tip: "صافي المبيعات ÷ قيمة المخزون الحالية" },
                ];
                if (r.employees.employeeCount > 0) {
                  kpis.push({
                    label: "مبيعات لكل موظف",
                    value: `${formatCurrency(r.employees.salesPerEmployee)} ج.م`,
                    tip: "مبيعات الموظفين ÷ عدد الموظفين النشطين",
                  });
                }
                return (
                  <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="⚡">
                    {kpis.map((k) => (
                      <BranchMetricRow
                        key={k.label}
                        emoji="⚡"
                        label={k.label}
                        value={k.value}
                      />
                    ))}
                  </BranchMetricCard>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("performance-score")} title="⭐ مؤشر الأداء العام" emoji="⭐">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((r, idx) => {
                const score = data!.performanceScores[r.branchId];
                if (!score) return null;
                return (
                  <BranchMetricCard key={r.branchId} branchName={r.branchName} branchIndex={idx} sectionEmoji="⭐">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold opacity-90">الدرجة الكلية</span>
                      <span className="text-2xl font-extrabold">
                        {score.insufficientData ? "—" : `${score.overall}/100`}
                      </span>
                    </div>
                    {!score.insufficientData ? (
                      <p className="text-[11px] font-semibold text-white/55 mb-4 leading-relaxed">
                        ترتيب نسبي بين الفروع في نفس الفترة — ليست درجة مطلقة على مقياس ثابت.
                      </p>
                    ) : null}
                    {score.insufficientData ? (
                      <p className="text-sm font-semibold opacity-90">{score.reasons[0]}</p>
                    ) : (
                      [
                        ["المبيعات", score.sales, score.weights.sales],
                        ["الربحية", score.profitability, score.weights.profitability],
                        ["المخزون", score.inventory, score.weights.inventory],
                        ["المصروفات", score.expenses, score.weights.expenses],
                        ["المرتجعات", score.returns, score.weights.returns],
                      ].map(([label, val, weight]) => (
                        <div key={String(label)} className="mb-3">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="opacity-85">{label} (وزن {weight}%)</span>
                            <span>{val as number}</span>
                          </div>
                          <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                            <div className="h-full rounded-full bg-white/70" style={{ width: `${val as number}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </BranchMetricCard>
                );
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection {...sectionProps("timeline")} title="📅 التحليل الزمني" emoji="📅">
            <div className="flex gap-2 flex-wrap mb-4">
              {rows.map((r) => {
                const selected = chartBranches.includes(r.branchId);
                return (
                  <button
                    key={r.branchId}
                    type="button"
                    onClick={() =>
                      setChartBranches((prev) =>
                        selected ? prev.filter((id) => id !== r.branchId) : [...prev, r.branchId]
                      )
                    }
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      selected
                        ? "bg-primary/25 text-white border border-primary/40"
                        : "border border-border text-muted"
                    )}
                  >
                    {r.branchName}
                  </button>
                );
              })}
            </div>
            <TimelineChart
              rows={rows.filter((r) => chartBranches.includes(r.branchId))}
            />
          </CollapsibleSection>

          <div className="glass-card p-4 mb-8">
            <p className="text-xs text-muted font-semibold mb-3">تنقل سريع بين الأقسام</p>
            <div className="flex gap-2 flex-wrap">
              {BRANCH_COMPARISON_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setOpenSection(s.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-muted hover:text-white hover:border-primary/30 transition-colors"
                >
                  {s.emoji} {s.title.replace(/^[^\s]+\s/, "")}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      <BranchInventoryDetailModal
        open={inventoryDetail !== null}
        onClose={() => setInventoryDetail(null)}
        branchName={inventoryDetail?.branchName ?? ""}
        filter={inventoryDetail?.filter ?? "out"}
        items={inventoryDetail?.items ?? []}
      />
    </>
  );
}
