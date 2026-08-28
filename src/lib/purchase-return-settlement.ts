import type { Prisma } from "@prisma/client";

import { roundPurchaseMoney } from "@/lib/purchase-payment-display";

type Tx = Prisma.TransactionClient;

/** نقد متبقٍ بعد خصم الأجل من إجمالي المرتجع */
export function computePurchaseReturnCashFromReturn(
  returnTotal: number,
  creditReduction: number
) {
  return roundPurchaseMoney(Math.max(0, returnTotal - creditReduction));
}

/** استرداد المصاريف من المورد — يُسجَّل تلقائياً في الخزنة (سطر منفصل) */
export function computePurchaseReturnExpenseRecoveryCash(
  expenseRecoveredAmount: number,
  cashFromReturn: number
) {
  if (expenseRecoveredAmount <= 0.0001 || cashFromReturn <= 0.0001) return 0;
  return roundPurchaseMoney(Math.min(expenseRecoveredAmount, cashFromReturn));
}

/** المبلغ الذي يُقسَّم يدوياً (وردية / لنا) — بدون جزء المصاريف المسترد */
export function computePurchaseReturnGoodsCashSettleable(
  returnTotal: number,
  creditReduction: number,
  expenseRecoveredAmount: number
) {
  const cashFromReturn = computePurchaseReturnCashFromReturn(returnTotal, creditReduction);
  const expenseRecoveryCash = computePurchaseReturnExpenseRecoveryCash(
    expenseRecoveredAmount,
    cashFromReturn
  );
  return roundPurchaseMoney(Math.max(0, cashFromReturn - expenseRecoveryCash));
}

/** @deprecated استخدم computePurchaseReturnGoodsCashSettleable */
export function computePurchaseReturnCashSettleable(
  returnTotal: number,
  creditReduction: number
) {
  return computePurchaseReturnCashFromReturn(returnTotal, creditReduction);
}

export function validatePurchaseReturnSettlement(
  cashSettleable: number,
  shiftDepositAmount: number,
  receivableAmount: number
) {
  const shift = roundPurchaseMoney(Math.max(0, shiftDepositAmount));
  const receivable = roundPurchaseMoney(Math.max(0, receivableAmount));

  if (cashSettleable <= 0.0001) {
    if (shift > 0.0001 || receivable > 0.0001) {
      throw new Error("SETTLEMENT_NOT_NEEDED");
    }
    return { shiftDepositAmount: 0, receivableAmount: 0 };
  }

  const sum = roundPurchaseMoney(shift + receivable);
  if (Math.abs(sum - cashSettleable) > 0.011) {
    throw new Error("SETTLEMENT_MISMATCH");
  }

  return { shiftDepositAmount: shift, receivableAmount: receivable };
}

export async function applyPurchaseReturnSettlement(
  tx: Tx,
  params: {
    branchId: string;
    purchaseId: string;
    supplierId: string;
    purchaseReturnId: string;
    returnNumber: string;
    receivableAmount: number;
    notes?: string | null;
  }
) {
  if (params.receivableAmount <= 0.0001) return null;

  return tx.purchaseSupplierReceivable.create({
    data: {
      branchId: params.branchId,
      purchaseId: params.purchaseId,
      purchaseReturnId: params.purchaseReturnId,
      supplierId: params.supplierId,
      amount: params.receivableAmount,
      collectedAmount: 0,
      notes:
        params.notes?.trim() ||
        `مستحق من مرتجع ${params.returnNumber}`,
    },
  });
}

export function receivableOutstanding(amount: number, collectedAmount: number) {
  return roundPurchaseMoney(Math.max(0, amount - collectedAmount));
}
