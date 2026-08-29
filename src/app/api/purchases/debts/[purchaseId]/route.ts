import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  CASH_SOURCE_LABELS,
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseDebtDisplayOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";

export interface PurchasePaymentScheduleRow {
  seq: number;
  phase: "invoice" | "settlement" | "return" | "collection";
  label: string;
  amount: number;
  paidAt: string;
  cashSourceLabel: string | null;
  notes: string | null;
  recordedByName: string | null;
  debtDelta: number;
  receivableDelta: number;
  runningDebt: number;
  runningReceivable: number;
  runningNetBalance: number;
}

type ScheduleDraft = Omit<
  PurchasePaymentScheduleRow,
  "seq" | "runningDebt" | "runningReceivable" | "runningNetBalance"
> & { sortTs: number; sortPriority: number; createdAt: number };

function finalizeSchedule(drafts: ScheduleDraft[]): PurchasePaymentScheduleRow[] {
  let runningDebt = 0;
  let runningReceivable = 0;
  return drafts.map((draft, index) => {
    runningDebt = roundPurchaseMoney(Math.max(0, runningDebt + draft.debtDelta));
    runningReceivable = roundPurchaseMoney(
      Math.max(0, runningReceivable + draft.receivableDelta)
    );
    return {
      seq: index + 1,
      phase: draft.phase,
      label: draft.label,
      amount: draft.amount,
      paidAt: draft.paidAt,
      cashSourceLabel: draft.cashSourceLabel,
      notes: draft.notes,
      recordedByName: draft.recordedByName,
      debtDelta: draft.debtDelta,
      receivableDelta: draft.receivableDelta,
      runningDebt,
      runningReceivable,
      runningNetBalance: roundPurchaseMoney(runningDebt - runningReceivable),
    };
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  const { purchaseId } = await params;

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, branchId: auth.branchId, status: "completed" },
    include: {
      supplier: { select: { nameAr: true } },
      returns: {
        select: {
          returnNumber: true,
          returnDate: true,
          subtotal: true,
          total: true,
          creditReductionAmount: true,
          shiftDepositAmount: true,
          receivableAmount: true,
          createdAt: true,
        },
        orderBy: { returnDate: "asc" },
      },
      creditLedgerEntries: {
        select: {
          id: true,
          creditAmount: true,
          paidAmount: true,
          payments: {
            where: { movementType: "payment" },
            orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              movementType: true,
              amount: true,
              paidAt: true,
              cashSource: true,
              notes: true,
              createdAt: true,
              createdBy: { select: { fullNameAr: true, username: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!purchase) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const receivableCollections = await prisma.purchaseReceivableCollection.findMany({
    where: { branchId: auth.branchId, receivable: { purchaseId } },
    orderBy: [{ collectedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amount: true,
      collectedAt: true,
      notes: true,
      createdAt: true,
      createdBy: { select: { fullNameAr: true, username: true } },
      receivable: { select: { purchaseReturn: { select: { returnNumber: true } } } },
    },
  });

  const purchaseReceivables = await prisma.purchaseSupplierReceivable.findMany({
    where: { branchId: auth.branchId, purchaseId },
    select: { amount: true, collectedAmount: true },
  });

  if (!["credit", "partial_credit"].includes(purchase.paymentType)) {
    return NextResponse.json({ message: "هذه الفاتورة ليست أجل" }, { status: 400 });
  }

  let initialPaymentAtInvoice = 0;
  let initialCashSourceLabel: string | null = null;

  if (purchase.paymentType === "partial_credit") {
    if (purchase.cashSource === "shift" && purchase.invoiceCashPaid > 0) {
      initialPaymentAtInvoice = purchase.invoiceCashPaid;
      initialCashSourceLabel = CASH_SOURCE_LABELS.shift;
    } else if (purchase.cashSource === "vault") {
      const vaultPay = await prisma.branchVaultMovement.findFirst({
        where: {
          branchId: auth.branchId,
          type: "purchase_payment",
          referenceType: "purchase",
          referenceId: purchase.id,
        },
        select: { amount: true },
      });
      if (vaultPay) {
        initialPaymentAtInvoice = vaultPay.amount;
        initialCashSourceLabel = CASH_SOURCE_LABELS.vault;
      }
    }
  }

  initialPaymentAtInvoice = roundPurchaseMoney(initialPaymentAtInvoice);
  const creditOnInvoice = roundPurchaseMoney(purchase.total - initialPaymentAtInvoice);

  const invoiceTs = purchase.purchaseDate.getTime();
  const drafts: ScheduleDraft[] = [];

  drafts.push({
    sortTs: invoiceTs,
    sortPriority: 0,
    createdAt: invoiceTs,
    phase: "invoice",
    label: "الدفع عند الفاتورة",
    amount: initialPaymentAtInvoice,
    paidAt: purchase.purchaseDate.toISOString(),
    cashSourceLabel: initialPaymentAtInvoice > 0 ? initialCashSourceLabel : null,
    notes:
      initialPaymentAtInvoice > 0
        ? null
        : "لم يُدفع مبلغ نقدي عند إنشاء الفاتورة",
    recordedByName: null,
    debtDelta: 0,
    receivableDelta: 0,
  });

  if (creditOnInvoice > 0.0001) {
    drafts.push({
      sortTs: invoiceTs,
      sortPriority: 1,
      createdAt: invoiceTs + 1,
      phase: "invoice",
      label: "فتح الأجل",
      amount: creditOnInvoice,
      paidAt: purchase.purchaseDate.toISOString(),
      cashSourceLabel: null,
      notes: PURCHASE_PAYMENT_TYPE_LABELS[purchase.paymentType] || purchase.paymentType,
      recordedByName: null,
      debtDelta: creditOnInvoice,
      receivableDelta: 0,
    });
  }

  const entry = purchase.creditLedgerEntries[0];
  const ledgerPayments = [...(entry?.payments ?? [])];

  for (const ret of purchase.returns) {
    const retTs = ret.returnDate.getTime();
    const retNote = `مرتجع مشتريات · ${ret.returnNumber}`;

    if (ret.creditReductionAmount > 0.0001) {
      drafts.push({
        sortTs: retTs,
        sortPriority: 2,
        createdAt: ret.createdAt.getTime(),
        phase: "return",
        label: "مرتجع مشتريات (خصم أجل)",
        amount: roundPurchaseMoney(ret.creditReductionAmount),
        paidAt: ret.returnDate.toISOString(),
        cashSourceLabel: null,
        notes: retNote,
        recordedByName: null,
        debtDelta: roundPurchaseMoney(-ret.creditReductionAmount),
        receivableDelta: 0,
      });
    }

    if (ret.receivableAmount > 0.0001) {
      drafts.push({
        sortTs: retTs,
        sortPriority: 3,
        createdAt: ret.createdAt.getTime() + 1,
        phase: "return",
        label: "مرتجع (مستحق لنا)",
        amount: roundPurchaseMoney(ret.receivableAmount),
        paidAt: ret.returnDate.toISOString(),
        cashSourceLabel: null,
        notes: retNote,
        recordedByName: null,
        debtDelta: 0,
        receivableDelta: roundPurchaseMoney(ret.receivableAmount),
      });
    }

    if (ret.shiftDepositAmount > 0.0001) {
      drafts.push({
        sortTs: retTs,
        sortPriority: 4,
        createdAt: ret.createdAt.getTime() + 2,
        phase: "return",
        label: "توريد مرتجع للوردية",
        amount: roundPurchaseMoney(ret.shiftDepositAmount),
        paidAt: ret.returnDate.toISOString(),
        cashSourceLabel: "وردية",
        notes: `${retNote} — لا يؤثر على رصيد الأجل`,
        recordedByName: null,
        debtDelta: 0,
        receivableDelta: 0,
      });
    }
  }

  let settlementIndex = 0;
  for (const movement of ledgerPayments) {
    settlementIndex += 1;
    const recordedByName =
      movement.createdBy?.fullNameAr || movement.createdBy?.username || null;
    drafts.push({
      sortTs: movement.paidAt.getTime(),
      sortPriority: 5,
      createdAt: movement.createdAt.getTime(),
      phase: "settlement",
      label: `سداد أجل (${settlementIndex})`,
      amount: roundPurchaseMoney(movement.amount),
      paidAt: movement.paidAt.toISOString(),
      cashSourceLabel: movement.cashSource
        ? CASH_SOURCE_LABELS[movement.cashSource] ?? movement.cashSource
        : null,
      notes: movement.notes,
      recordedByName,
      debtDelta: roundPurchaseMoney(-movement.amount),
      receivableDelta: 0,
    });
  }

  for (const collection of receivableCollections) {
    const recordedByName =
      collection.createdBy?.fullNameAr || collection.createdBy?.username || null;
    drafts.push({
      sortTs: collection.collectedAt.getTime(),
      sortPriority: 6,
      createdAt: collection.createdAt.getTime(),
      phase: "collection",
      label: "تحصيل مستحق مورد",
      amount: roundPurchaseMoney(collection.amount),
      paidAt: collection.collectedAt.toISOString(),
      cashSourceLabel: "وردية",
      notes:
        collection.notes ||
        `مرتجع مشتريات · ${collection.receivable.purchaseReturn.returnNumber}`,
      recordedByName,
      debtDelta: 0,
      receivableDelta: roundPurchaseMoney(-collection.amount),
    });
  }

  drafts.sort((a, b) => {
    if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.createdAt - b.createdAt;
  });

  const schedule = finalizeSchedule(drafts);

  const creditEntry = entry ?? null;
  const outstanding = purchaseDebtDisplayOutstanding(purchase, creditEntry);
  const laterPaymentsTotal = roundPurchaseMoney(
    schedule.filter((row) => row.phase === "settlement").reduce((sum, row) => sum + row.amount, 0)
  );

  const returnsGoodsTotal = roundPurchaseMoney(
    purchase.returns.reduce((sum, ret) => sum + ret.subtotal, 0)
  );
  const totalAfterReturns = roundPurchaseMoney(Math.max(0, purchase.total - returnsGoodsTotal));
  const receivableOutstandingOnPurchase = roundPurchaseMoney(
    purchaseReceivables.reduce(
      (sum, row) =>
        sum + Math.max(0, roundPurchaseMoney(row.amount - row.collectedAmount)),
      0
    )
  );

  let netDirection: "linna" | "alaina" | "balanced" = "balanced";
  let netAmount = 0;
  let netLabel = "متزن";

  if (receivableOutstandingOnPurchase > outstanding + 0.0001) {
    netDirection = "linna";
    netAmount = roundPurchaseMoney(receivableOutstandingOnPurchase - outstanding);
    netLabel = "لنا";
  } else if (outstanding > receivableOutstandingOnPurchase + 0.0001) {
    netDirection = "alaina";
    netAmount = roundPurchaseMoney(outstanding - receivableOutstandingOnPurchase);
    netLabel = "علينا";
  }

  return NextResponse.json({
    purchase: {
      id: purchase.id,
      invoiceNumber: purchase.invoiceNumber,
      purchaseDate: purchase.purchaseDate.toISOString(),
      supplierName: purchase.supplier.nameAr,
      paymentType: purchase.paymentType,
      paymentTypeLabel: PURCHASE_PAYMENT_TYPE_LABELS[purchase.paymentType] || purchase.paymentType,
      total: purchase.total,
      paidAmount: purchase.paidAmount,
      outstanding,
      creditOnInvoice,
      initialPaymentAtInvoice,
      laterPaymentsTotal,
      returnsSummary: {
        count: purchase.returns.length,
        totalAmount: returnsGoodsTotal,
        totalAfterReturns,
      },
      receivableOutstanding: receivableOutstandingOnPurchase,
      netBalance: {
        direction: netDirection,
        amount: netAmount,
        label: netLabel,
      },
    },
    schedule,
  });
}
