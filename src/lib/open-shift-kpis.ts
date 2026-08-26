import { type Prisma as PrismaNamespace } from "@prisma/client";

import {
  computeActualCash,
  netPurchasesTotal,
  sumCogsForSaleIds,
  sumCogsForSaleReturnIds,
} from "@/lib/dashboard-metrics";
import { prisma } from "@/lib/prisma";
import { sumOpenShiftVaultDeposits } from "@/lib/branch-vault";
import {
  buildAllTreasuryTransactions,
  type TreasuryTransaction,
} from "@/lib/treasury-ledger";

type Db = PrismaNamespace.TransactionClient | typeof prisma;

export interface OpenShiftKpis {
  /** صافي المبيعات = إجمالي الفواتير − مرتجعات المبيعات (وردية لم تُقفل) */
  shiftSales: number;
  /** إجمالي فواتير المبيعات قبل خصم المرتجعات */
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
  /** سداد أجل مشتريات من الوردية */
  shiftPurchaseDebtPaymentsTotal: number;
}

async function getDepositedEntryKeys(db: Db, branchId: string): Promise<Set<string>> {
  try {
    const rows = await db.treasuryShiftEntry.findMany({
      where: { shift: { branchId } },
      select: { entryKey: true },
    });
    return new Set(rows.map((row) => row.entryKey));
  } catch {
    return new Set();
  }
}

function aggregatePendingRows(pending: TreasuryTransaction[]) {
  let shiftSales = 0;
  let shiftPurchasesGross = 0;
  let shiftExpenses = 0;
  let shiftSaleReturnsTotal = 0;
  let shiftPurchaseReturnSubtotal = 0;
  let shiftPurchaseExpenseRecovered = 0;
  let shiftPurchaseDebtPaymentsTotal = 0;
  let shiftSalesInvoicesCount = 0;
  let shiftPurchaseInvoicesCount = 0;
  let shiftSaleReturnsCount = 0;
  const purchaseReturnNumbers = new Set<string>();
  const pendingSaleIds: string[] = [];
  const pendingSaleReturnIds: string[] = [];

  for (const row of pending) {
    switch (row.type) {
      case "sale":
        shiftSales += row.amount;
        shiftSalesInvoicesCount += 1;
        pendingSaleIds.push(row.id);
        break;
      case "purchase":
        shiftPurchasesGross += row.amount;
        shiftPurchaseInvoicesCount += 1;
        break;
      case "purchase_debt_payment":
        shiftPurchaseDebtPaymentsTotal += row.amount;
        break;
      case "expense":
        shiftExpenses += row.amount;
        break;
      case "sale_return":
        shiftSaleReturnsTotal += row.amount;
        shiftSaleReturnsCount += 1;
        pendingSaleReturnIds.push(row.id);
        break;
      case "purchase_return":
        shiftPurchaseReturnSubtotal += row.amount;
        purchaseReturnNumbers.add(row.documentNumber);
        break;
      case "purchase_return_expense_recovery":
        shiftPurchaseExpenseRecovered += row.amount;
        purchaseReturnNumbers.add(row.documentNumber);
        break;
    }
  }

  const shiftPurchaseReturnsTotal =
    Math.round((shiftPurchaseReturnSubtotal + shiftPurchaseExpenseRecovered) * 100) / 100;

  return {
    shiftSales: Math.round(shiftSales * 100) / 100,
    shiftPurchasesGross: Math.round(shiftPurchasesGross * 100) / 100,
    shiftExpenses: Math.round(shiftExpenses * 100) / 100,
    shiftSaleReturnsTotal: Math.round(shiftSaleReturnsTotal * 100) / 100,
    shiftPurchaseReturnSubtotal: Math.round(shiftPurchaseReturnSubtotal * 100) / 100,
    shiftPurchaseExpenseRecovered: Math.round(shiftPurchaseExpenseRecovered * 100) / 100,
    shiftPurchaseDebtPaymentsTotal: Math.round(shiftPurchaseDebtPaymentsTotal * 100) / 100,
    shiftSalesInvoicesCount,
    shiftPurchaseInvoicesCount,
    shiftSaleReturnsCount,
    shiftPurchaseReturnsCount: purchaseReturnNumbers.size,
    shiftPurchaseReturnsTotal,
    pendingSaleIds,
    pendingSaleReturnIds,
  };
}

export async function computeOpenShiftKpis(branchId: string): Promise<OpenShiftKpis> {
  const [allRows, depositedKeys] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    getDepositedEntryKeys(prisma, branchId),
  ]);

  const pending = allRows.filter((row) => !depositedKeys.has(row.id));
  const agg = aggregatePendingRows(pending);
  const [salesCogs, returnCogs] = await Promise.all([
    sumCogsForSaleIds(prisma, branchId, agg.pendingSaleIds),
    sumCogsForSaleReturnIds(prisma, branchId, agg.pendingSaleReturnIds),
  ]);
  const shiftCogs = Math.round((salesCogs - returnCogs) * 100) / 100;
  const shiftSalesNet = Math.round((agg.shiftSales - agg.shiftSaleReturnsTotal) * 100) / 100;
  const shiftProfit =
    Math.round((shiftSalesNet - shiftCogs - agg.shiftExpenses) * 100) / 100;
  const shiftPurchasesNet = netPurchasesTotal(
    agg.shiftPurchasesGross,
    agg.shiftPurchaseReturnsTotal
  );
  const shiftActualCash = computeActualCash({
    salesTotal: agg.shiftSales,
    expensesTotal: agg.shiftExpenses,
    purchasesGross: agg.shiftPurchasesGross,
    purchaseDebtPaymentsTotal: agg.shiftPurchaseDebtPaymentsTotal,
    purchaseReturnsTotal: agg.shiftPurchaseReturnsTotal,
    saleReturnsTotal: agg.shiftSaleReturnsTotal,
  });
  const shiftVaultDeposited = await sumOpenShiftVaultDeposits(prisma, branchId);
  const shiftRemainingCash = Math.round((shiftActualCash - shiftVaultDeposited) * 100) / 100;

  return {
    shiftSales: shiftSalesNet,
    shiftSalesGross: agg.shiftSales,
    shiftProfit,
    shiftActualCash: shiftRemainingCash,
    shiftCogs,
    shiftExpenses: agg.shiftExpenses,
    shiftPurchasesNet,
    shiftPurchasesGross: agg.shiftPurchasesGross,
    shiftSaleReturnsTotal: agg.shiftSaleReturnsTotal,
    shiftPurchaseReturnSubtotal: agg.shiftPurchaseReturnSubtotal,
    shiftPurchaseExpenseRecovered: agg.shiftPurchaseExpenseRecovered,
    shiftSalesInvoicesCount: agg.shiftSalesInvoicesCount,
    shiftPurchaseInvoicesCount: agg.shiftPurchaseInvoicesCount,
    shiftSaleReturnsCount: agg.shiftSaleReturnsCount,
    shiftPurchaseReturnsCount: agg.shiftPurchaseReturnsCount,
    shiftPurchaseReturnsTotal: agg.shiftPurchaseReturnsTotal,
    shiftPurchaseDebtPaymentsTotal: agg.shiftPurchaseDebtPaymentsTotal,
  };
}
