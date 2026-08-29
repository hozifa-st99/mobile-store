import { formatCurrency } from "@/lib/utils";
import { receivableOutstanding } from "@/lib/purchase-return-settlement";

export interface ReturnSettlementInput {
  total: number;
  creditReductionAmount: number;
  shiftDepositAmount: number;
  receivableAmount: number;
  expenseRecoveredAmount: number;
  expenseHandling: string | null;
  collectedAmount?: number;
}

export function describePurchaseReturnSettlement(input: ReturnSettlementInput): string[] {
  const lines: string[] = [];

  if (input.creditReductionAmount > 0.001) {
    lines.push(`خصم من الأجل: ${formatCurrency(input.creditReductionAmount)} ج.م`);
  }

  if (input.shiftDepositAmount > 0.001) {
    lines.push(`توريد للوردية: ${formatCurrency(input.shiftDepositAmount)} ج.م`);
  }

  if (input.receivableAmount > 0.001) {
    const outstanding =
      input.collectedAmount !== undefined
        ? receivableOutstanding(input.receivableAmount, input.collectedAmount)
        : input.receivableAmount;
    if (outstanding > 0.001) {
      lines.push(
        `مسجّل لنا عند المورد: ${formatCurrency(input.receivableAmount)} ج.م (متبقي ${formatCurrency(outstanding)} ج.م)`
      );
    } else if (input.collectedAmount !== undefined && input.collectedAmount > 0.001) {
      lines.push(
        `تم تحصيله: ${formatCurrency(input.collectedAmount)} ج.م من أصل ${formatCurrency(input.receivableAmount)} ج.م`
      );
    } else {
      lines.push(`مسجّل لنا عند المورد: ${formatCurrency(input.receivableAmount)} ج.م`);
    }
  }

  if (input.expenseRecoveredAmount > 0.001) {
    lines.push(`استرداد مصاريف: ${formatCurrency(input.expenseRecoveredAmount)} ج.م`);
  }

  if (input.expenseHandling === "daily_expense" && input.expenseRecoveredAmount > 0.001) {
    lines.push(`مصروف يومي: ${formatCurrency(input.expenseRecoveredAmount)} ج.م`);
  }

  const settledParts =
    input.shiftDepositAmount +
    input.receivableAmount +
    input.creditReductionAmount +
    input.expenseRecoveredAmount;

  if (lines.length === 0 && input.total > 0.001) {
    lines.push("مرتجع بدون تسوية نقدية");
  } else if (settledParts <= 0.001 && input.total > 0.001 && input.creditReductionAmount <= 0.001) {
    lines.push("لم تُسجَّل تسوية");
  }

  return lines;
}
