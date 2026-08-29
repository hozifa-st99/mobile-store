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
  /** مبلغ التعامل للعرض فقط (+/−) */
  transactionAmount: number;
  /** زيادة في مديونيتنا (+) أو خصم (−) */
  debtDelta: number;
  /** زيادة في مستحقاتنا (+) أو تحصيل (−) */
  receivableDelta: number;
  runningDebt: number;
  runningReceivable: number;
  netBalance: number;
  notes: string | null;
  /** عرض — نقد دُفع عند الفاتورة */
  cashPaidAtInvoice?: number;
  /** عرض — أجل افتُتح عند الفاتورة */
  creditOpenedAtInvoice?: number;
  /** عرض — إجمالي الفاتورة */
  invoiceTotal?: number;
}

export interface SupplierStatementResult {
  supplier: { id: string; nameAr: string; phone: string | null };
  summary: {
    totalCreditPurchases: number;
    totalInvoiceAmount: number;
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
  purchase: "فاتورة " + "مشتريات",
  payment: "سداد أجل",
  return_credit: "مرتجع (خصم أجل)",
  return_shift: "مرتجع (توريد وردية)",
  return_receivable: "مرتجع (مستحق لنا)",
  collection: "تحصيل مستحق",
};

type RawEntry = Omit<
  SupplierStatementEntry,
  "runningDebt" | "runningReceivable" | "netBalance"
> & { sortPriority: number };

function originalCreditAmount(
  creditEntry: { creditAmount: number } | null,
  purchase: { total: number; invoiceCashPaid: number },
  creditReductionsSum: number
) {
  if (creditEntry) {
    return roundPurchaseMoney(creditEntry.creditAmount + creditReductionsSum);
  }
  return roundPurchaseMoney(Math.max(0, purchase.total - (purchase.invoiceCashPaid || 0)));
}

async function resolveInitialPaymentAtInvoice(
  branchId: string,
  purchase: {
    id: string;
    paymentType: string;
    cashSource: string | null;
    invoiceCashPaid: number;
  }
) {
  if (purchase.paymentType !== "partial_credit") return 0;

  if (purchase.cashSource === "shift" && purchase.invoiceCashPaid > 0) {
    return roundPurchaseMoney(purchase.invoiceCashPaid);
  }

  if (purchase.cashSource === "vault") {
    const vaultPay = await prisma.branchVaultMovement.findFirst({
      where: {
        branchId,
        type: "purchase_payment",
        referenceType: "purchase",
        referenceId: purchase.id,
      },
      select: { amount: true },
    });
    if (vaultPay) return roundPurchaseMoney(vaultPay.amount);
  }

  return 0;
}

export async function buildSupplierAccountStatement(
  branchId: string,
  supplierId: string
): Promise<SupplierStatementResult | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId },
    select: { companyId: true },
  });
  if (!branch) return null;

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, companyId: branch.companyId },
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
                createdAt: true,
              },
              orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
            },
          },
          take: 1,
        },
        returns: {
          select: {
            id: true,
            returnNumber: true,
            returnDate: true,
            creditReductionAmount: true,
            shiftDepositAmount: true,
            receivableAmount: true,
            notes: true,
            createdAt: true,
          },
          orderBy: [{ returnDate: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.purchaseSupplierReceivable.findMany({
      where: { branchId, supplierId },
      include: {
        purchase: { select: { invoiceNumber: true } },
        purchaseReturn: { select: { returnNumber: true, returnDate: true } },
        collections: {
          select: {
            id: true,
            amount: true,
            collectedAt: true,
            notes: true,
            createdAt: true,
          },
          orderBy: [{ collectedAt: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const rawEntries: RawEntry[] = [];
  let totalCreditPurchases = 0;
  let totalInvoiceAmount = 0;
  let totalActuallyPaidToSupplier = 0;
  let debtOutstanding = 0;

  for (const purchase of purchases) {
    const creditEntry = purchase.creditLedgerEntries[0] ?? null;
    const outstanding = purchaseDebtDisplayOutstanding(purchase, creditEntry);
    debtOutstanding += outstanding;

    const creditReductionsSum = roundPurchaseMoney(
      purchase.returns.reduce((sum, ret) => sum + ret.creditReductionAmount, 0)
    );
    const openingCredit = originalCreditAmount(creditEntry, purchase, creditReductionsSum);
    const initialCash = await resolveInitialPaymentAtInvoice(branchId, purchase);

    totalCreditPurchases += openingCredit;
    totalInvoiceAmount += purchase.total;
    totalActuallyPaidToSupplier = roundPurchaseMoney(
      totalActuallyPaidToSupplier + initialCash
    );
    for (const payment of creditEntry?.payments ?? []) {
      totalActuallyPaidToSupplier = roundPurchaseMoney(
        totalActuallyPaidToSupplier + payment.amount
      );
    }

    const noteParts = [
      `إجمالي ${roundPurchaseMoney(purchase.total)} ج.م`,
      initialCash > 0.0001 ? `نقد ${roundPurchaseMoney(initialCash)} ج.م` : null,
      openingCredit > 0.0001 ? `أجل ${roundPurchaseMoney(openingCredit)} ج.م` : null,
      PURCHASE_PAYMENT_TYPE_LABELS[purchase.paymentType] || purchase.paymentType,
    ].filter(Boolean);

    rawEntries.push({
      id: `purchase-${purchase.id}`,
      date: purchase.purchaseDate.toISOString(),
      type: "purchase",
      typeLabel: TYPE_LABELS.purchase,
      reference: purchase.invoiceNumber,
      transactionAmount: roundPurchaseMoney(purchase.total),
      debtDelta: openingCredit,
      receivableDelta: 0,
      notes: noteParts.join(" · "),
      sortPriority: 1,
      cashPaidAtInvoice: initialCash > 0.0001 ? initialCash : undefined,
      creditOpenedAtInvoice: openingCredit > 0.0001 ? openingCredit : undefined,
      invoiceTotal: roundPurchaseMoney(purchase.total),
    });

    for (const payment of creditEntry?.payments ?? []) {
      rawEntries.push({
        id: `payment-${payment.id}`,
        date: payment.paidAt.toISOString(),
        type: "payment",
        typeLabel: TYPE_LABELS.payment,
        reference: purchase.invoiceNumber,
        transactionAmount: roundPurchaseMoney(-payment.amount),
        debtDelta: roundPurchaseMoney(-payment.amount),
        receivableDelta: 0,
        notes: payment.cashSource
          ? `${CASH_SOURCE_LABELS[payment.cashSource] ?? payment.cashSource}${payment.notes ? ` · ${payment.notes}` : ""}`
          : payment.notes,
        sortPriority: 3,
      });
    }

    for (const ret of purchase.returns) {
      if (ret.creditReductionAmount > 0.001) {
        rawEntries.push({
          id: `return-credit-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_credit",
          typeLabel: TYPE_LABELS.return_credit,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          transactionAmount: roundPurchaseMoney(-ret.creditReductionAmount),
          debtDelta: roundPurchaseMoney(-ret.creditReductionAmount),
          receivableDelta: 0,
          notes: ret.notes,
          sortPriority: 2,
        });
      }

      if (ret.receivableAmount > 0.001) {
        rawEntries.push({
          id: `return-receivable-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_receivable",
          typeLabel: TYPE_LABELS.return_receivable,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          transactionAmount: ret.receivableAmount,
          debtDelta: 0,
          receivableDelta: ret.receivableAmount,
          notes: "مستحق لنا عند المورد",
          sortPriority: 4,
        });
      }

      if (ret.shiftDepositAmount > 0.001) {
        rawEntries.push({
          id: `return-shift-${ret.id}`,
          date: ret.returnDate.toISOString(),
          type: "return_shift",
          typeLabel: TYPE_LABELS.return_shift,
          reference: `${ret.returnNumber} · ${purchase.invoiceNumber}`,
          transactionAmount: roundPurchaseMoney(ret.shiftDepositAmount),
          debtDelta: 0,
          receivableDelta: 0,
          notes: `توريد نقدي للوردية · ${roundPurchaseMoney(ret.shiftDepositAmount)} ج.م — لا يؤثر على رصيد الحساب`,
          sortPriority: 6,
        });
      }
    }
  }

  let totalReceivableSum = 0;
  let totalCollected = 0;
  let receivableOutstandingSum = 0;

  for (const receivable of receivables) {
    totalReceivableSum += receivable.amount;
    totalCollected += receivable.collectedAmount;
    receivableOutstandingSum += receivableOutstanding(
      receivable.amount,
      receivable.collectedAmount
    );

    for (const collection of receivable.collections) {
      rawEntries.push({
        id: `collection-${collection.id}`,
        date: collection.collectedAt.toISOString(),
        type: "collection",
        typeLabel: TYPE_LABELS.collection,
        reference: `${receivable.purchaseReturn.returnNumber} · ${receivable.purchase.invoiceNumber}`,
        transactionAmount: roundPurchaseMoney(collection.amount),
        debtDelta: 0,
        receivableDelta: roundPurchaseMoney(-collection.amount),
        notes: collection.notes,
        sortPriority: 5,
      });
    }
  }

  rawEntries.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.id.localeCompare(b.id);
  });

  let runningDebt = 0;
  let runningReceivable = 0;
  const entries: SupplierStatementEntry[] = rawEntries.map((entry) => {
    runningDebt = roundPurchaseMoney(Math.max(0, runningDebt + entry.debtDelta));
    runningReceivable = roundPurchaseMoney(
      Math.max(0, runningReceivable + entry.receivableDelta)
    );
    const netBalance = roundPurchaseMoney(runningDebt - runningReceivable);
    return {
      id: entry.id,
      date: entry.date,
      type: entry.type,
      typeLabel: entry.typeLabel,
      reference: entry.reference,
      transactionAmount: entry.transactionAmount,
      debtDelta: entry.debtDelta,
      receivableDelta: entry.receivableDelta,
      runningDebt,
      runningReceivable,
      netBalance,
      notes: entry.notes,
      ...(entry.cashPaidAtInvoice != null
        ? { cashPaidAtInvoice: entry.cashPaidAtInvoice }
        : {}),
      ...(entry.creditOpenedAtInvoice != null
        ? { creditOpenedAtInvoice: entry.creditOpenedAtInvoice }
        : {}),
      ...(entry.invoiceTotal != null ? { invoiceTotal: entry.invoiceTotal } : {}),
    };
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
      totalInvoiceAmount: roundPurchaseMoney(totalInvoiceAmount),
      totalPaidOnUs: roundPurchaseMoney(totalActuallyPaidToSupplier),
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
