import { prisma } from "@/lib/prisma";
import {
  CASH_SOURCE_LABELS,
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseDebtDisplayOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";
import { receivableOutstanding } from "@/lib/purchase-return-settlement";

export type StatementEntryType =
  | "purchase"
  | "payment"
  | "return_credit"
  | "return_shift"
  | "return_receivable"
  | "collection";

export interface SupplierStatementEntry {
  id: string;
  date: string;
  type: StatementEntryType;
  typeLabel: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  notes: string | null;
}

export interface SupplierStatementResult {
  supplier: { id: string; nameAr: string; phone: string | null };
  summary: {
    totalCreditPurchases: number;
    totalPaidOnUs: number;
    debtOutstanding: number;
    totalReceivable: number;
    totalCollected: number;
    receivableOutstanding: number;
    netDirection: "linna" | "alaina" | "balanced";
    netAmount: number;
    netLabel: string;
  };
  entries: SupplierStatementEntry[];
}

const TYPE_LABELS: Record<StatementEntryType, string> = {
  purchase: "فاتورة أجل",
  payment: "سداد",
  return_credit: "مرتجع (خصم أجل)",
  return_shift: "مرتجع (وردية)",
  return_receivable: "مرتجع (مستحق لنا)",
  collection: "تحصيل مستحق",
};

type RawEntry = Omit<SupplierStatementEntry, "balance">;

export async function buildSupplierAccountStatement(
  branchId: string,
  supplierId: string
): Promise<SupplierStatementResult | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, branchId },
    select: { id: true, nameAr: true, phone: true },
  });
  if (!supplier) return null;

  const [purchases, receivables] = await Promise.all([
    prisma.purchase.findMany({
      where: {
        branchId,
        supplierId,
        status: "completed",
        paymentType: { in: ["credit", "partial_credit"] },
      },
      include: {
        creditLedgerEntries: {
          select: {
            creditAmount: true,
            paidAmount: true,
            payments: {
              where: { movementType: "payment" },
              select: {
                id: true,
                amount: true,
                paidAt: true,
                cashSource: true,
                notes: true,
              },
              orderBy: [{ paidAt: "asc" }],
            },
          },
          take: 1,
        },
        returns: {
          select: {
            id: true,
            returnNumber: true,
            returnDate: true,
            total: true,
            creditReductionAmount: true,
            shiftDepositAmount: true,
            receivableAmount: true,
            notes: true,
          },
          orderBy: { returnDate: "asc" },
        },
      },
      orderBy: [{ purchaseDate: "asc" }],
    }),
    prisma.purchaseSupplierReceivable.findMany({
      where: { branchId, supplierId },
      include: {
        purchase: { select: { invoiceNumber: true } },
        purchaseReturn: { select: { returnNumber: true } },
        collections: {
          select: {
            id: true,
            amount: true,
            collectedAt: true,
            notes: true,
          },
          orderBy: [{ collectedAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const rawEntries: RawEntry[] = [];

  let totalCreditPurchases = 0;
  let totalPaidOnUs = 0;
  let debtOutstanding = 0;

  for (const purchase of purchases) {
    const creditEntry = purchase.creditLedgerEntries[0] ?? null;
    const outstanding = purchaseDebtDisplayOutstanding(purchase, creditEntry);
    const creditAmount = roundPurchaseMoney(purchase.total - (purchase.invoiceCashPaid || 0));

    totalCreditPurchases += creditAmount;
    totalPaidOnUs += purchase.paidAmount;
    debtOutstanding += outstanding;

    rawEntries.push({
      id: `purchase-${purchase.id}`,
      date: purchase.purchaseDate.toISOString(),
      type: "purchase",
      typeLabel: TYPE_LABELS.purchase,
      reference: purchase.invoiceNumber,
      debit: creditAmount,
      credit: 0,
      notes:
        PURCHASE_PAYMENT_TYPE_LABELS[purchase.paymentType] || purchase.paymentType,
    });

    for (const ret of purchase.returns) {
      if (ret.creditReductionAmount > 0.001) {
        rawEntries.push({
          id: `return-credit-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_credit",
          typeLabel: TYPE_LABELS.return_credit,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          debit: 0,
          credit: ret.creditReductionAmount,
          notes: ret.notes,
        });
      }
      if (ret.shiftDepositAmount > 0.001) {
        rawEntries.push({
          id: `return-shift-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_shift",
          typeLabel: TYPE_LABELS.return_shift,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          debit: 0,
          credit: ret.shiftDepositAmount,
          notes: "توريد للوردية",
        });
      }
      if (ret.receivableAmount > 0.001) {
        rawEntries.push({
          id: `return-receivable-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_receivable",
          typeLabel: TYPE_LABELS.return_receivable,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          debit: 0,
          credit: ret.receivableAmount,
          notes: "مستحق لنا عند المورد",
        });
      }
    }

    const ledgerPayments = creditEntry?.payments ?? [];
    for (const payment of ledgerPayments) {
      rawEntries.push({
        id: `payment-${payment.id}`,
        date: payment.paidAt.toISOString(),
        type: "payment",
        typeLabel: TYPE_LABELS.payment,
        reference: purchase.invoiceNumber,
        debit: 0,
        credit: payment.amount,
        notes: payment.cashSource
          ? `${CASH_SOURCE_LABELS[payment.cashSource] ?? payment.cashSource}${payment.notes ? ` · ${payment.notes}` : ""}`
          : payment.notes,
      });
    }
  }

  let totalReceivableSum = 0;
  let totalCollected = 0;
  let receivableOutstandingSum = 0;

  for (const receivable of receivables) {
    totalReceivableSum += receivable.amount;
    totalCollected += receivable.collectedAmount;
    receivableOutstandingSum += receivableOutstanding(receivable.amount, receivable.collectedAmount);

    for (const collection of receivable.collections) {
      rawEntries.push({
        id: `collection-${collection.id}`,
        date: collection.collectedAt.toISOString(),
        type: "collection",
        typeLabel: TYPE_LABELS.collection,
        reference: `${receivable.purchaseReturn.returnNumber} · ${receivable.purchase.invoiceNumber}`,
        debit: collection.amount,
        credit: 0,
        notes: collection.notes,
      });
    }
  }

  rawEntries.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  const entries: SupplierStatementEntry[] = rawEntries.map((entry) => {
    runningBalance = roundPurchaseMoney(runningBalance + entry.debit - entry.credit);
    return { ...entry, balance: runningBalance };
  });

  const netDebt = roundPurchaseMoney(debtOutstanding);
  const netReceivable = roundPurchaseMoney(receivableOutstandingSum);
  let netDirection: "linna" | "alaina" | "balanced" = "balanced";
  let netAmount = 0;
  let netLabel = "متزن";

  if (netReceivable > netDebt + 0.0001) {
    netDirection = "linna";
    netAmount = roundPurchaseMoney(netReceivable - netDebt);
    netLabel = "لنا عند المورد";
  } else if (netDebt > netReceivable + 0.0001) {
    netDirection = "alaina";
    netAmount = roundPurchaseMoney(netDebt - netReceivable);
    netLabel = "علينا للمورد";
  }

  return {
    supplier,
    summary: {
      totalCreditPurchases: roundPurchaseMoney(totalCreditPurchases),
      totalPaidOnUs: roundPurchaseMoney(totalPaidOnUs),
      debtOutstanding: netDebt,
      totalReceivable: roundPurchaseMoney(totalReceivableSum),
      totalCollected: roundPurchaseMoney(totalCollected),
      receivableOutstanding: netReceivable,
      netDirection,
      netAmount,
      netLabel,
    },
    entries,
  };
}