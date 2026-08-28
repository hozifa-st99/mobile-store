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
  runningPaidTotal: number;
}

type LedgerMovement = {
  id: string;
  movementType: string;
  amount: number;
  paidAt: Date;
  cashSource: string | null;
  notes: string | null;
  createdAt: Date;
  createdBy: { fullNameAr: string; username: string } | null;
};

function movementSortKey(movement: LedgerMovement) {
  const ts = movement.paidAt.getTime() || movement.createdAt.getTime();
  const priority =
    movement.movementType === "purchase_return"
      ? 2
      : movement.movementType === "payment"
        ? 3
        : 1;
  return { ts, priority };
}

type ScheduleCandidate = {
  sortTs: number;
  sortPriority: number;
  createdAt: number;
  row: PurchasePaymentScheduleRow;
};

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
          shiftDepositAmount: true,
        },
        orderBy: { returnDate: "asc" },
      },
      creditLedgerEntries: {
        select: {
          id: true,
          creditAmount: true,
          paidAmount: true,
          payments: {
            where: { movementType: { in: ["payment", "purchase_return"] } },
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

  const schedule: PurchasePaymentScheduleRow[] = [];
  let runningPaid = initialPaymentAtInvoice;
  let seq = 0;

  seq += 1;
  schedule.push({
    seq,
    phase: "invoice",
    label: "الدفع عند الفاتورة",
    amount: initialPaymentAtInvoice,
    paidAt: purchase.purchaseDate.toISOString(),
    cashSourceLabel: initialPaymentAtInvoice > 0 ? initialCashSourceLabel : null,
    notes: initialPaymentAtInvoice > 0 ? null : "لم يُدفع مبلغ نقدي عند إنشاء الفاتورة",
    recordedByName: null,
    runningPaidTotal: runningPaid,
  });

  const entry = purchase.creditLedgerEntries[0];
  const ledgerMovements = [...(entry?.payments ?? [])].sort((a, b) => {
    const ka = movementSortKey(a);
    const kb = movementSortKey(b);
    if (ka.ts !== kb.ts) return ka.ts - kb.ts;
    if (ka.priority !== kb.priority) return ka.priority - kb.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const candidates: ScheduleCandidate[] = [];

  for (const ret of purchase.returns) {
    if (ret.shiftDepositAmount <= 0.0001) continue;
    candidates.push({
      sortTs: ret.returnDate.getTime(),
      sortPriority: 2,
      createdAt: ret.returnDate.getTime(),
      row: {
        seq: 0,
        phase: "return",
        label: "توريد مرتجع للوردية",
        amount: ret.shiftDepositAmount,
        paidAt: ret.returnDate.toISOString(),
        cashSourceLabel: "وردية",
        notes: `مرتجع ${ret.returnNumber}`,
        recordedByName: null,
        runningPaidTotal: 0,
      },
    });
  }

  for (const movement of ledgerMovements) {
    const recordedByName =
      movement.createdBy?.fullNameAr || movement.createdBy?.username || null;

    if (movement.movementType === "purchase_return") {
      candidates.push({
        sortTs: movement.paidAt.getTime(),
        sortPriority: 2,
        createdAt: movement.createdAt.getTime(),
        row: {
          seq: 0,
          phase: "return",
          label: "مرتجع مشتريات (خصم أجل)",
          amount: movement.amount,
          paidAt: movement.paidAt.toISOString(),
          cashSourceLabel: null,
          notes: movement.notes,
          recordedByName,
          runningPaidTotal: 0,
        },
      });
      continue;
    }

    candidates.push({
      sortTs: movement.paidAt.getTime(),
      sortPriority: 3,
      createdAt: movement.createdAt.getTime(),
      row: {
        seq: 0,
        phase: "settlement",
        label: "سداد أجل",
        amount: movement.amount,
        paidAt: movement.paidAt.toISOString(),
        cashSourceLabel: movement.cashSource
          ? CASH_SOURCE_LABELS[movement.cashSource] ?? movement.cashSource
          : null,
        notes: movement.notes,
        recordedByName,
        runningPaidTotal: 0,
      },
    });
  }

  for (const collection of receivableCollections) {
    candidates.push({
      sortTs: collection.collectedAt.getTime(),
      sortPriority: 4,
      createdAt: collection.createdAt.getTime(),
      row: {
        seq: 0,
        phase: "collection",
        label: "تحصيل مستحق مورد",
        amount: collection.amount,
        paidAt: collection.collectedAt.toISOString(),
        cashSourceLabel: "وردية",
        notes:
          collection.notes ||
          `رقم المرتجع ${collection.receivable.purchaseReturn.returnNumber}`,
        recordedByName:
          collection.createdBy?.fullNameAr || collection.createdBy?.username || null,
        runningPaidTotal: 0,
      },
    });
  }

  candidates.sort((a, b) => {
    if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    return a.createdAt - b.createdAt;
  });

  let settlementIndex = 0;
  for (const candidate of candidates) {
    seq += 1;
    if (candidate.row.phase === "settlement") {
      settlementIndex += 1;
      runningPaid = roundPurchaseMoney(runningPaid + candidate.row.amount);
      candidate.row.label = `سداد أجل (${settlementIndex})`;
      candidate.row.runningPaidTotal = runningPaid;
    } else {
      candidate.row.runningPaidTotal = runningPaid;
    }
    candidate.row.seq = seq;
    schedule.push(candidate.row);
  }

  const creditEntry = entry ?? null;
  const outstanding = purchaseDebtDisplayOutstanding(purchase, creditEntry);
  const creditOnInvoice = roundPurchaseMoney(purchase.total - initialPaymentAtInvoice);
  const laterPaymentsTotal = roundPurchaseMoney(
    schedule.filter((row) => row.phase === "settlement").reduce((sum, row) => sum + row.amount, 0)
  );

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
    },
    schedule,
  });
}
