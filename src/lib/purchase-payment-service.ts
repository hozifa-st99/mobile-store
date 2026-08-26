import type { Prisma } from "@prisma/client";

import {
  parseCashSource,
  parsePurchasePaymentType,
  recordBranchVaultMovement,
  resolvePurchasePayment,
  type PurchasePaymentType,
  type VaultCashSource,
} from "@/lib/branch-vault";
import { syncEntryPaidAmountFromMovements } from "@/lib/credit-ledger-service";

type Tx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export function parsePurchasePaymentBody(body: {
  paymentType?: unknown;
  paidAmount?: unknown;
  cashSource?: unknown;
}) {
  const paymentType = parsePurchasePaymentType(body.paymentType) ?? "full_cash";
  const paidAmountInput =
    body.paidAmount != null && body.paidAmount !== "" ? Number(body.paidAmount) : undefined;
  const cashSource = parseCashSource(body.cashSource);
  return { paymentType, paidAmountInput, cashSource };
}

export function validatePurchasePaymentInput(
  total: number,
  paymentType: PurchasePaymentType,
  paidAmountInput: number | undefined,
  cashSource: VaultCashSource | null
) {
  let paidAmount: number;
  let creditAmount: number;
  try {
    ({ paidAmount, creditAmount } = resolvePurchasePayment({
      paymentType,
      total,
      paidAmountInput,
    }));
  } catch {
    return { error: "المبلغ المدفوع للأجل الجزئي غير صالح" as const };
  }

  if (paidAmount > 0 && !cashSource) {
    return { error: "اختر مصدر الدفع النقدي (الوردية أو خزنة الفرع)" as const };
  }
  if (paidAmount <= 0 && cashSource) {
    return { error: "مصدر الدفع غير مطلوب للفاتورة الآجلة بالكامل" as const };
  }

  return { paidAmount, creditAmount, paymentType, cashSource };
}

export async function applyPurchasePaymentSideEffects(
  tx: Tx,
  params: {
    companyId: string;
    branchId: string;
    userId: string;
    purchaseId: string;
    invoiceNumber: string;
    supplierId: string;
    supplierName: string;
    purchaseDate: Date;
    paidAmount: number;
    creditAmount: number;
    cashSource: VaultCashSource | null;
  }
) {
  if (params.paidAmount > 0 && params.cashSource === "vault") {
    await recordBranchVaultMovement(tx, {
      branchId: params.branchId,
      type: "purchase_payment",
      direction: "out",
      amount: params.paidAmount,
      referenceType: "purchase",
      referenceId: params.purchaseId,
      movementDate: params.purchaseDate,
      documentNumber: params.invoiceNumber,
      description: `دفع فاتورة مشتريات ${params.invoiceNumber} — ${params.supplierName}`,
      createdByUserId: params.userId,
    });
  }

  if (params.creditAmount <= 0) return;

  const entry = await tx.creditLedgerEntry.create({
    data: {
      companyId: params.companyId,
      branchId: params.branchId,
      partyType: "supplier",
      supplierId: params.supplierId,
      purchaseId: params.purchaseId,
      entryDate: params.purchaseDate,
      creditAmount: params.creditAmount,
      paidAmount: 0,
      notes: `أجل فاتورة مشتريات ${params.invoiceNumber}`,
      createdByUserId: params.userId,
    },
  });

  await tx.creditLedgerPayment.create({
    data: {
      entryId: entry.id,
      movementType: "credit_open",
      amount: params.creditAmount,
      paidAt: params.purchaseDate,
      notes: entry.notes,
      createdByUserId: params.userId,
    },
  });

  await syncEntryPaidAmountFromMovements(tx, entry.id);
}

export async function recordPurchaseDebtPayment(
  tx: Tx,
  params: {
    companyId: string;
    branchId: string;
    userId: string;
    purchaseId: string;
    invoiceNumber: string;
    supplierName: string;
    amount: number;
    cashSource: VaultCashSource;
    paidAt?: Date;
    notes?: string | null;
  }
) {
  const entry = await tx.creditLedgerEntry.findFirst({
    where: { purchaseId: params.purchaseId, companyId: params.companyId },
    select: { id: true, creditAmount: true, paidAmount: true },
  });
  if (!entry) {
    throw new Error("CREDIT_ENTRY_NOT_FOUND");
  }

  const outstanding = Math.round((entry.creditAmount - entry.paidAmount) * 100) / 100;
  if (params.amount <= 0 || params.amount > outstanding + 0.0001) {
    throw new Error("INVALID_PAYMENT_AMOUNT");
  }

  const paidAt = params.paidAt ?? new Date();

  await tx.creditLedgerPayment.create({
    data: {
      entryId: entry.id,
      movementType: "payment",
      amount: params.amount,
      paidAt,
      cashSource: params.cashSource,
      branchId: params.branchId,
      notes: params.notes ?? null,
      createdByUserId: params.userId,
    },
  });

  await syncEntryPaidAmountFromMovements(tx, entry.id);

  await tx.purchase.update({
    where: { id: params.purchaseId },
    data: { paidAmount: { increment: params.amount } },
  });

  if (params.cashSource === "vault") {
    await recordBranchVaultMovement(tx, {
      branchId: params.branchId,
      type: "purchase_debt_payment",
      direction: "out",
      amount: params.amount,
      referenceType: "purchase",
      referenceId: params.purchaseId,
      movementDate: paidAt,
      documentNumber: params.invoiceNumber,
      description: `سداد أجل فاتورة ${params.invoiceNumber} — ${params.supplierName}`,
      notes: params.notes ?? null,
      createdByUserId: params.userId,
    });
  }
}
