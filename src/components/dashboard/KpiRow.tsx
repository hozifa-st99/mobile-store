"use client";

import KpiCard from "./KpiCard";
import ActualCashTreasuryCard from "./ActualCashTreasuryCard";
import ProfitBreakdownInfo from "@/components/ui/ProfitBreakdownInfo";
import { useDashboard } from "./DashboardProvider";

export default function KpiRow() {
  const { kpis, refresh } = useDashboard();

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          variant="sales"
          delay={0}
          title="مبيعات الوردية"
          value={kpis.shiftSales}
          suffix="ج.م"
          subtitle="لم تُورد بعد"
          emoji="💰"
        />
        <KpiCard
          variant="expenses"
          delay={80}
          title="المصاريف"
          value={kpis.shiftExpenses}
          suffix="ج.م"
          subtitle="لم تُورد بعد"
          emoji="💸"
        />
        <KpiCard
          variant={kpis.shiftProfit >= 0 ? "profit" : "loss"}
          delay={160}
          title="صافي الربح"
          value={kpis.shiftProfit}
          suffix="ج.م"
          subtitle="الوردية الحالية"
          emoji={kpis.shiftProfit >= 0 ? "📈" : "📉"}
          titleInfo={
            <ProfitBreakdownInfo
              actualCash={kpis.shiftActualCash}
              purchases={kpis.shiftPurchasesNet}
              saleReturns={kpis.shiftSaleReturnsTotal}
              purchaseReturnSubtotal={kpis.shiftPurchaseReturnSubtotal}
              purchaseExpenseRecovered={kpis.shiftPurchaseExpenseRecovered}
              purchaseDebtPayments={kpis.shiftPurchaseDebtPaymentsTotal}
              profit={kpis.shiftProfit}
              cogs={kpis.shiftCogs}
              expenses={kpis.shiftExpenses}
              sales={kpis.shiftSales}
              mode="hover"
            />
          }
        />
        <KpiCard
          variant="invoices"
          delay={240}
          title="فواتير الوردية"
          subtitle="لم تُورد بعد"
          emoji="🧾"
          splitLayout="stack"
          splitRows={[
            {
              label: "فواتير مبيعات",
              count: kpis.shiftSalesInvoicesCount,
              total: kpis.shiftSalesGross,
            },
            {
              label: "فواتير مشتريات",
              count: kpis.shiftPurchaseInvoicesCount,
              total: kpis.shiftPurchasesGross,
            },
          ]}
        />
        <KpiCard
          variant="loss"
          delay={320}
          title="مرتجعات"
          subtitle="لم تُورد بعد"
          emoji="↩️"
          splitLayout="stack"
          splitRows={[
            {
              label: "مرتجعات مبيعات",
              count: kpis.shiftSaleReturnsCount,
              total: kpis.shiftSaleReturnsTotal,
            },
            {
              label: "مرتجعات مشتريات",
              count: kpis.shiftPurchaseReturnsCount,
              total: kpis.shiftPurchaseReturnsTotal,
            },
          ]}
        />
      </div>

      <ActualCashTreasuryCard
        value={kpis.shiftActualCash}
        branchVaultBalance={kpis.branchVaultBalance}
        onDepositSuccess={refresh}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard
          compact
          variant="inventory"
          delay={0}
          title="منتجات متاحة"
          value={kpis.productsCount}
          subtitle="في المخزون"
          emoji="📦"
        />
        <KpiCard
          compact
          variant="customers"
          delay={80}
          title="إجمالي العملاء"
          value={kpis.customersCount}
          subtitle="عميل مسجل"
          emoji="👥"
        />
      </div>
    </div>
  );
}
