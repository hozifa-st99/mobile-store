import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
  SUPPLIER_KIND_WHOLESALE,
} from "@/lib/supplier-kind";import {
  CASH_SOURCE_LABELS,
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";

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
  creditLedgerEntries: { id: string }[];
}) {
  const outstanding = purchaseOutstanding(p.total, p.paidAmount);
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
      creditLedgerEntries: { select: { id: true }, take: 1 },
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

  return NextResponse.json({
    outstandingRows,
    settledRows,
    totals: {
      totalAmount: roundPurchaseMoney(outstandingTotals.totalAmount),
      paidAmount: roundPurchaseMoney(outstandingTotals.paidAmount),
      outstanding: roundPurchaseMoney(outstandingTotals.outstanding),
    },
    supplierOptions,
  });
}
