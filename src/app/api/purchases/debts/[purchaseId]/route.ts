import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  CASH_SOURCE_LABELS,
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";

export interface PurchasePaymentScheduleRow {
  seq: number;
  phase: "invoice" | "settlement";
  label: string;
  amount: number;
  paidAt: string;
  cashSourceLabel: string | null;
  notes: string | null;
  recordedByName: string | null;
  runningPaidTotal: number;
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
              amount: true,
              paidAt: true,
              cashSource: true,
              notes: true,
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

  schedule.push({
    seq: 1,
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
  let settlementIndex = 0;
  for (const pay of entry?.payments ?? []) {
    settlementIndex += 1;
    runningPaid = roundPurchaseMoney(runningPaid + pay.amount);
    schedule.push({
      seq: settlementIndex + 1,
      phase: "settlement",
      label: `سداد أجل (${settlementIndex})`,
      amount: pay.amount,
      paidAt: pay.paidAt.toISOString(),
      cashSourceLabel: pay.cashSource
        ? CASH_SOURCE_LABELS[pay.cashSource] ?? pay.cashSource
        : null,
      notes: pay.notes,
      recordedByName: pay.createdBy?.fullNameAr || pay.createdBy?.username || null,
      runningPaidTotal: runningPaid,
    });
  }

  const outstanding = purchaseOutstanding(purchase.total, purchase.paidAmount);
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
