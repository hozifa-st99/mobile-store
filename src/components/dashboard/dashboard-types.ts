export interface DashboardData {
  kpis: {
    shiftSales: number;
    shiftSalesGross: number;
    shiftProfit: number;
    shiftActualCash: number;
    shiftCogs: number;
    shiftExpenses: number;
    shiftPurchasesNet: number;
    shiftPurchasesGross: number;
    shiftSaleReturnsTotal: number;
    shiftPurchaseReturnSubtotal: number;
    shiftPurchaseExpenseRecovered: number;
    shiftSalesInvoicesCount: number;
    shiftPurchaseInvoicesCount: number;
    shiftSaleReturnsCount: number;
    shiftPurchaseReturnsCount: number;
    shiftPurchaseReturnsTotal: number;
    shiftPurchaseDebtPaymentsTotal: number;
    branchVaultBalance: number;
    productsCount: number;
    customersCount: number;
    lowStockCount: number;
  };
  recentSales: {
    id: string;
    invoiceNumber: string;
    customer: string;
    total: number;
    status: string;
    date: string;
  }[];
  topProducts: { name: string; quantity: number; revenue: number; imageUrl?: string | null }[];
  salesChart: { day: string; sales: number }[];
  openShiftHourlyChart: { hour: string; hourKey: number; sales: number; profit: number }[];
}

export const emptyDashboard: DashboardData = {
  kpis: {
    shiftSales: 0,
    shiftSalesGross: 0,
    shiftProfit: 0,
    shiftActualCash: 0,
    shiftCogs: 0,
    shiftExpenses: 0,
    shiftPurchasesNet: 0,
    shiftPurchasesGross: 0,
    shiftSaleReturnsTotal: 0,
    shiftPurchaseReturnSubtotal: 0,
    shiftPurchaseExpenseRecovered: 0,
    shiftSalesInvoicesCount: 0,
    shiftPurchaseInvoicesCount: 0,
    shiftSaleReturnsCount: 0,
    shiftPurchaseReturnsCount: 0,
    shiftPurchaseReturnsTotal: 0,
    shiftPurchaseDebtPaymentsTotal: 0,
    branchVaultBalance: 0,
    productsCount: 0,
    customersCount: 0,
    lowStockCount: 0,
  },
  recentSales: [],
  topProducts: [],
  salesChart: [],
  openShiftHourlyChart: [],
};
