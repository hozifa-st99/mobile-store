import type { ConfirmedPurchaseLine } from "@/components/purchases/purchase-line-types";
import { lineSubtotal } from "@/lib/purchase-line-display";

export type ExpenseDistribution = "value" | "quantity" | "manual";

export interface PurchaseInvoiceExpense {
  id: string;
  nameAr: string;
  amount: number;
  distribution: ExpenseDistribution;
  manualAllocations?: Record<string, number>;
}

export interface LineExpenseResult {
  lineId: string;
  expenseShare: number;
  unitPriceBefore: number;
  unitPriceAfter: number;
  quantity: number;
  lineTotalAfter: number;
}

export function getLineQuantity(line: ConfirmedPurchaseLine): number {
  if (line.lineType === "phone") return 1;
  return line.data.quantity;
}

export function getLineUnitPrice(line: ConfirmedPurchaseLine): number {
  return line.data.unitPrice;
}

function emptyAlloc(lines: ConfirmedPurchaseLine[]): Record<string, number> {
  return Object.fromEntries(lines.map((l) => [l.id, 0]));
}

export function allocateSingleExpense(
  expense: PurchaseInvoiceExpense,
  lines: ConfirmedPurchaseLine[]
): Record<string, number> {
  const result = emptyAlloc(lines);
  if (expense.amount <= 0 || lines.length === 0) return result;

  if (expense.distribution === "manual" && expense.manualAllocations) {
    for (const line of lines) {
      result[line.id] = expense.manualAllocations[line.id] ?? 0;
    }
    return result;
  }

  if (expense.distribution === "quantity") {
    const totalQty = lines.reduce((s, l) => s + getLineQuantity(l), 0);
    if (totalQty <= 0) return result;
    for (const line of lines) {
      result[line.id] = expense.amount * (getLineQuantity(line) / totalQty);
    }
    return result;
  }

  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  if (subtotal <= 0) return result;
  for (const line of lines) {
    result[line.id] = expense.amount * (lineSubtotal(line) / subtotal);
  }
  return result;
}

export function computeLineExpenses(
  lines: ConfirmedPurchaseLine[],
  expenses: PurchaseInvoiceExpense[]
): LineExpenseResult[] {
  const shareByLine = emptyAlloc(lines);

  for (const expense of expenses) {
    const alloc = allocateSingleExpense(expense, lines);
    for (const line of lines) {
      shareByLine[line.id] += alloc[line.id];
    }
  }

  return lines.map((line) => {
    const quantity = getLineQuantity(line);
    const unitPriceBefore = getLineUnitPrice(line);
    const expenseShare = shareByLine[line.id];
    const perUnitExpense = quantity > 0 ? expenseShare / quantity : 0;
    const unitPriceAfter = unitPriceBefore + perUnitExpense;
    return {
      lineId: line.id,
      expenseShare,
      unitPriceBefore,
      unitPriceAfter,
      quantity,
      lineTotalAfter: unitPriceAfter * quantity,
    };
  });
}

export function totalExpenseAmount(expenses: PurchaseInvoiceExpense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function findRetailBelowCostAfterExpense(
  lines: ConfirmedPurchaseLine[],
  expenses: PurchaseInvoiceExpense[],
  lineLabel: (line: ConfirmedPurchaseLine) => string
): string | null {
  if (expenses.length === 0 || lines.length === 0) return null;

  const results = computeLineExpenses(lines, expenses);
  const byLineId = new Map(results.map((r) => [r.lineId, r]));

  for (const line of lines) {
    const result = byLineId.get(line.id);
    if (!result) continue;

    const costAfter = Math.round(result.unitPriceAfter * 100) / 100;
    if (line.data.retailPrice > 0 && line.data.retailPrice < costAfter) {
      return `سعر البيع أقل من سعر الشراء بعد المصروف — ${lineLabel(line)}`;
    }
  }

  return null;
}
