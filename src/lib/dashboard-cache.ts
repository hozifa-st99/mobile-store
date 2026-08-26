import type { DashboardData } from "@/components/dashboard/dashboard-types";
import { emptyDashboard } from "@/components/dashboard/dashboard-types";

const CACHE_PREFIX = "ms-dashboard-cache-v7";
const CACHE_TTL_MS = 45_000;

const LEGACY_CACHE_KEYS = ["ms-dashboard-cache", "ms-dashboard-cache-v6"];

export function dashboardCacheKey(branchId: string) {
  return `${CACHE_PREFIX}:${branchId}`;
}

function normalizeDashboardData(input: Partial<DashboardData> | null | undefined): DashboardData {
  const d = input ?? {};
  const kpis = { ...emptyDashboard.kpis, ...(d.kpis ?? {}) };

  return {
    ...emptyDashboard,
    ...d,
    kpis: {
      shiftSales: Number(kpis.shiftSales) || 0,
      shiftSalesGross: Number(kpis.shiftSalesGross) || 0,
      shiftProfit: Number(kpis.shiftProfit) || 0,
      shiftActualCash: Number(kpis.shiftActualCash) || 0,
      shiftCogs: Number(kpis.shiftCogs) || 0,
      shiftExpenses: Number(kpis.shiftExpenses) || 0,
      shiftPurchasesNet: Number(kpis.shiftPurchasesNet) || 0,
      shiftPurchasesGross: Number(kpis.shiftPurchasesGross) || 0,
      shiftSaleReturnsTotal: Number(kpis.shiftSaleReturnsTotal) || 0,
      shiftPurchaseReturnSubtotal: Number(kpis.shiftPurchaseReturnSubtotal) || 0,
      shiftPurchaseExpenseRecovered: Number(kpis.shiftPurchaseExpenseRecovered) || 0,
      shiftSalesInvoicesCount: Number(kpis.shiftSalesInvoicesCount) || 0,
      shiftPurchaseInvoicesCount: Number(kpis.shiftPurchaseInvoicesCount) || 0,
      shiftSaleReturnsCount: Number(kpis.shiftSaleReturnsCount) || 0,
      shiftPurchaseReturnsCount: Number(kpis.shiftPurchaseReturnsCount) || 0,
      shiftPurchaseReturnsTotal: Number(kpis.shiftPurchaseReturnsTotal) || 0,
      shiftPurchaseDebtPaymentsTotal: Number(kpis.shiftPurchaseDebtPaymentsTotal) || 0,
      branchVaultBalance: Number(kpis.branchVaultBalance) || 0,
      productsCount: Number(kpis.productsCount) || 0,
      customersCount: Number(kpis.customersCount) || 0,
      lowStockCount: Number(kpis.lowStockCount) || 0,
    },
    recentSales: d.recentSales ?? emptyDashboard.recentSales,
    topProducts: d.topProducts ?? emptyDashboard.topProducts,
    salesChart: d.salesChart ?? emptyDashboard.salesChart,
    openShiftHourlyChart: d.openShiftHourlyChart ?? emptyDashboard.openShiftHourlyChart,
  };
}

export function readDashboardCache(branchId: string): DashboardData | null {
  if (typeof window === "undefined" || !branchId) return null;
  try {
    const raw = sessionStorage.getItem(dashboardCacheKey(branchId));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: Partial<DashboardData> };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return normalizeDashboardData(data);
  } catch {
    return null;
  }
}

export function writeDashboardCache(branchId: string, data: DashboardData) {
  if (!branchId) return;
  try {
    sessionStorage.setItem(
      dashboardCacheKey(branchId),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    /* ignore quota errors */
  }
}

/** يمسح الكاش القديم (بدون branchId) وكل نسخ v7 عند تسجيل الخروج أو قبل تبديل الفرع */
export function clearDashboardCaches() {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_CACHE_KEYS) {
      sessionStorage.removeItem(key);
    }
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(`${CACHE_PREFIX}:`)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

export { normalizeDashboardData };
