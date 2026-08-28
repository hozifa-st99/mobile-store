import type { Prisma } from "@prisma/client";

import { parseLedgerNotes } from "@/lib/credit-ledger-service";
import { receivableOutstanding } from "@/lib/purchase-return-settlement";
import { roundPurchaseMoney } from "@/lib/purchase-payment-display";

type Tx = Prisma.TransactionClient;

export async function recordPurchaseReceivableCollection(
  tx: Tx,
  params: {
    branchId: string;
    userId: string;
    receivableId: string;
    amount: number;
    notes?: string | null;
    collectedAt?: Date;
  }
) {
  const receivable = await tx.purchaseSupplierReceivable.findFirst({
    where: { id: params.receivableId, branchId: params.branchId },
    include: {
      purchase: { select: { invoiceNumber: true } },
      purchaseReturn: { select: { returnNumber: true } },
      supplier: { select: { nameAr: true } },
    },
  });

  if (!receivable) {
    throw new Error("RECEIVABLE_NOT_FOUND");
  }

  const outstanding = receivableOutstanding(receivable.amount, receivable.collectedAmount);
  if (params.amount <= 0 || params.amount > outstanding + 0.0001) {
    throw new Error("INVALID_COLLECTION_AMOUNT");
  }

  const collectedAt = params.collectedAt ?? new Date();
  const notes = parseLedgerNotes(params.notes);

  await tx.purchaseReceivableCollection.create({
    data: {
      receivableId: receivable.id,
      branchId: params.branchId,
      amount: roundPurchaseMoney(params.amount),
      collectedAt,
      notes,
      createdByUserId: params.userId,
    },
  });

  const newCollected = roundPurchaseMoney(receivable.collectedAmount + params.amount);
  await tx.purchaseSupplierReceivable.update({
    where: { id: receivable.id },
    data: { collectedAmount: newCollected },
  });

  return {
    outstanding: roundPurchaseMoney(Math.max(0, outstanding - params.amount)),
    returnNumber: receivable.purchaseReturn.returnNumber,
    invoiceNumber: receivable.purchase.invoiceNumber,
    supplierName: receivable.supplier.nameAr,
  };
}
