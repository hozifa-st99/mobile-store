import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
  SUPPLIER_KIND_WHOLESALE,
} from "@/lib/supplier-kind";
import {
  CASH_SOURCE_LABELS,
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseDebtDisplayOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";
import { receivableOutstanding } from "@/lib/purchase-return-settlement";

function mapDebtRow(p: {
  id: string;
  invoiceNumber: string;
  purchaseDate: Date;
  dueDate: Date | null;
  total: number;
  paidAmount: number;
  paymentType: string;
  cashSource: string | null;
  invoiceCashPaid: number;
  supplier: { id: string; nameAr: string; phone: string | null; supplierKind: string };
  creditLedgerEntries: { id: string; creditAmount: number; paidAmount: number }[];
}) {
  const creditEntry = p.creditLedgerEntries[0] ?? null;
  const outstanding = purchaseDebtDisplayOutstanding(p, creditEntry);
  return {
    id: p.id,
    invoiceNumber: p.invoiceNumber,
    purchaseDate: p.purchaseDate.toISOString(),
    dueDate: p.dueDate?.toISOString() ?? null,
    supplierId: p.supplier.id,
    supplierName: p.supplier.nameAr,
    supplierPhone: p.supplier.phone,
    total: p.total,
    paidAmount: p.paidAmount,
    outstanding,
    paymentType: p.paymentType,
    paymentTypeLabel: PURCHASE_PAYMENT_TYPE_LABELS[p.paymentType] || p.paymentType,
    creditLedgerEntryId: p.creditLedgerEntries[0]?.id ?? null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const supplierId = (searchParams.get("supplierId") || "").trim();
  const search = (searchParams.get("search") || "").trim();
  const supplierKind = searchParams.get("supplierKind")?.trim();

  const supplierKindFilter =
    supplierKind === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER
      ? SUPPLIER_KIND_INDIVIDUAL_CUSTOMER
      : supplierKind === SUPPLIER_KIND_WHOLESALE || !supplierKind
        ? SUPPLIER_KIND_WHOLESALE
        : null;

  const purchases = await prisma.purchase.findMany({
    where: {
      branchId: auth.branchId,
      status: "completed",
      paymentType: { in: ["credit", "partial_credit"] },
      ...(supplierKindFilter && {
        supplier: { supplierKind: supplierKindFilter },
      }),
    },
    include: {
      supplier: { select: { id: true, nameAr: true, phone: true, supplierKind: true } },
      creditLedgerEntries: {
        select: { id: true, creditAmount: true, paidAmount: true },
        take: 1,
      },
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });

  let rows = purchases.map(mapDebtRow);

  if (supplierId) {
    rows = rows.filter((r) => r.supplierId === supplierId);
  }

  if (search) {
    rows = rows.filter(
      (r) =>
        r.invoiceNumber.includes(search) ||
        r.supplierName.includes(search) ||
        (r.supplierPhone?.includes(search) ?? false)
    );
  }

  const outstandingRows = rows.filter((r) => r.outstanding > 0.0001);
  const settledRows = rows.filter((r) => r.outstanding <= 0.0001);

  const outstandingTotals = outstandingRows.reduce(
    (acc, row) => {
      acc.totalAmount += row.total;
      acc.paidAmount += row.paidAmount;
      acc.outstanding += row.outstanding;
      return acc;
    },
    { totalAmount: 0, paidAmount: 0, outstanding: 0 }
  );

  const supplierOptions = Array.from(
    new Map(
      rows.map((r) => [
        r.supplierId,
        { id: r.supplierId, nameAr: r.supplierName, phone: r.supplierPhone },
      ])
    ).values()
  ).sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));

  const receivableRecords = await prisma.purchaseSupplierReceivable.findMany({
    where: {
      branchId: auth.branchId,
      ...(supplierKindFilter && {
        supplier: { supplierKind: supplierKindFilter },
      }),
    },
    include: {
      supplier: { select: { id: true, nameAr: true, phone: true, supplierKind: true } },
      purchase: { select: { invoiceNumber: true, purchaseDate: true } },
      purchaseReturn: { select: { returnNumber: true, returnDate: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  let receivableRows = receivableRecords.map((r) => ({
    id: r.id,
    purchaseId: r.purchaseId,
    invoiceNumber: r.purchase.invoiceNumber,
    returnNumber: r.purchaseReturn.returnNumber,
    returnDate: r.purchaseReturn.returnDate.toISOString(),
    purchaseDate: r.purchase.purchaseDate.toISOString(),
    supplierId: r.supplier.id,
    supplierName: r.supplier.nameAr,
    supplierPhone: r.supplier.phone,
    amount: r.amount,
    collectedAmount: r.collectedAmount,
    outstanding: receivableOutstanding(r.amount, r.collectedAmount),
    notes: r.notes,
  }));

  if (supplierId) {
    receivableRows = receivableRows.filter((r) => r.supplierId === supplierId);
  }

  if (search) {
    receivableRows = receivableRows.filter(
      (r) =>
        r.invoiceNumber.includes(search) ||
        r.returnNumber.includes(search) ||
        r.supplierName.includes(search) ||
        (r.supplierPhone?.includes(search) ?? false)
    );
  }

  const outstandingReceivableRows = receivableRows.filter((r) => r.outstanding > 0.0001);
  const collectedReceivableRows = receivableRows.filter((r) => r.outstanding <= 0.0001);
  const receivableTotalsAll = receivableRows.reduce(
    (acc, row) => {
      acc.amount += row.amount;
      acc.collectedAmount += row.collectedAmount;
      acc.outstanding += row.outstanding;
      return acc;
    },
    { amount: 0, collectedAmount: 0, outstanding: 0 }
  );

  return NextResponse.json({
    outstandingRows,
    settledRows,
    outstandingReceivableRows,
    collectedReceivableRows,
    totals: {
      totalAmount: roundPurchaseMoney(outstandingTotals.totalAmount),
      paidAmount: roundPurchaseMoney(outstandingTotals.paidAmount),
      outstanding: roundPurchaseMoney(outstandingTotals.outstanding),
    },
    receivableTotals: {
      amount: roundPurchaseMoney(receivableTotalsAll.amount),
      collectedAmount: roundPurchaseMoney(receivableTotalsAll.collectedAmount),
      outstanding: roundPurchaseMoney(receivableTotalsAll.outstanding),
    },
    supplierOptions,
  });
}
