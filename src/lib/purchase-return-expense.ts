import { parseInvoiceExpenseTotal } from "@/lib/purchase-invoice-notes";

export type PurchaseReturnExpenseHandling =
  | "redistribute"
  | "daily_expense"
  | "partial_recovery";

export interface ExpenseHandlingSplit {
  recovered: number;
  toRedistribute: number;
  toDailyExpense: number;
}

export function computeExpenseHandlingSplit(input: {
  handling: PurchaseReturnExpenseHandling;
  totalOrphaned: number;
  recoveredAmount?: number;
  hasRemainingItems: boolean;
}): ExpenseHandlingSplit {
  const { handling, totalOrphaned, recoveredAmount = 0, hasRemainingItems } = input;
  if (totalOrphaned <= 0.001) {
    return { recovered: 0, toRedistribute: 0, toDailyExpense: 0 };
  }

  if (handling === "redistribute") {
    return {
      recovered: 0,
      toRedistribute: hasRemainingItems ? totalOrphaned : 0,
      toDailyExpense: hasRemainingItems ? 0 : totalOrphaned,
    };
  }

  if (handling === "daily_expense") {
    return { recovered: 0, toRedistribute: 0, toDailyExpense: totalOrphaned };
  }

  const recovered = Math.min(Math.max(0, recoveredAmount), totalOrphaned);
  const unrecovered = Math.round((totalOrphaned - recovered) * 100) / 100;
  if (unrecovered <= 0.001) {
    return { recovered, toRedistribute: 0, toDailyExpense: 0 };
  }
  if (hasRemainingItems) {
    return { recovered, toRedistribute: unrecovered, toDailyExpense: 0 };
  }
  return { recovered, toRedistribute: 0, toDailyExpense: unrecovered };
}

export interface ReturnLinePricing {
  unitPriceBefore: number;
  unitPriceAfter: number;
  hasExpenseLine: boolean;
  refundUnitPrice: number;
  expensePerUnit: number;
  refundTotal: number;
  expenseShare: number;
}

export function lineReturnPricing(
  unitPriceAfter: number,
  unitPriceBefore: number | null | undefined,
  quantity: number
): ReturnLinePricing {
  const after = unitPriceAfter;
  const before = unitPriceBefore ?? after;
  const hasExpenseLine =
    unitPriceBefore != null && Math.abs(before - after) > 0.001;
  const expensePerUnit = hasExpenseLine ? after - before : 0;
  const refundUnitPrice = before;

  return {
    unitPriceBefore: before,
    unitPriceAfter: after,
    hasExpenseLine,
    refundUnitPrice,
    expensePerUnit,
    refundTotal: refundUnitPrice * quantity,
    expenseShare: expensePerUnit * quantity,
  };
}

export interface PurchaseItemForReturnPricing {
  id: string;
  quantity: number;
  unitPrice: number;
}

/** يحسب تسعير الإرجاع — من unit_price_before أو من مصاريف notes للفواتير القديمة */
export function resolveLineReturnPricing(
  item: PurchaseItemForReturnPricing,
  allItems: PurchaseItemForReturnPricing[],
  unitPriceBeforeFromDb: number | null | undefined,
  expenseLine: string | null | undefined,
  returnQty: number
): ReturnLinePricing {
  if (
    unitPriceBeforeFromDb != null &&
    Math.abs(unitPriceBeforeFromDb - item.unitPrice) > 0.001
  ) {
    return lineReturnPricing(item.unitPrice, unitPriceBeforeFromDb, returnQty);
  }

  const totalExpense = parseInvoiceExpenseTotal(expenseLine);
  if (totalExpense <= 0.001 || allItems.length === 0) {
    return lineReturnPricing(item.unitPrice, unitPriceBeforeFromDb, returnQty);
  }

  const totalValue = allItems.reduce((s, row) => s + row.quantity * row.unitPrice, 0);
  if (totalValue <= 0) {
    return lineReturnPricing(item.unitPrice, unitPriceBeforeFromDb, returnQty);
  }

  const lineValue = item.quantity * item.unitPrice;
  const lineExpenseShare = totalExpense * (lineValue / totalValue);
  const expensePerUnit = lineExpenseShare / item.quantity;
  const unitPriceAfter = item.unitPrice;
  const unitPriceBefore = Math.round((unitPriceAfter - expensePerUnit) * 100) / 100;

  return lineReturnPricing(unitPriceAfter, unitPriceBefore, returnQty);
}

export interface RemainingItemForRedistribute {
  purchaseItemId: string;
  productId: string;
  remainingQty: number;
  unitPriceBefore: number;
  currentUnitPriceAfter: number;
}

/** يوزّع مصروف الأصناف المُرجَعة على البنود المتبقية حسب القيمة */
export function allocateOrphanedExpenseToRemaining(
  orphanedExpense: number,
  remaining: RemainingItemForRedistribute[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (orphanedExpense <= 0 || remaining.length === 0) return result;

  const totalValue = remaining.reduce(
    (s, r) => s + r.remainingQty * r.unitPriceBefore,
    0
  );
  if (totalValue <= 0) return result;

  for (const row of remaining) {
    const weight = (row.remainingQty * row.unitPriceBefore) / totalValue;
    result.set(row.purchaseItemId, orphanedExpense * weight);
  }
  return result;
}
