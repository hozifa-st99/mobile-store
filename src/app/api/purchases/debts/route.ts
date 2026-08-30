import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
  SUPPLIER_KIND_WHOLESALE,
} from "@/lib/supplier-kind";
import {
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseDebtDisplayOutstanding,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";
import { receivableOutstanding } from "@/lib/purchase-return-settlement";

function mapDebtRow(
  p: {
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
  },
  receivables: {
    id: string;
    returnNumber: string;
    amount: number;
    collectedAmount: number;
    outstanding: number;
  }[]
) {
  const creditEntry = p.creditLedgerEntries[0] ?? null;
  const outstanding = purchaseDebtDisplayOutstanding(p, creditEntry);
  const receivableAmount = roundPurchaseMoney(
    receivables.reduce((sum, row) => sum + row.amount, 0)
  );
  const receivableCollected = roundPurchaseMoney(
    receivables.reduce((sum, row) => sum + row.collectedAmount, 0)
  );
  const receivableOutstandingTotal = roundPurchaseMoney(
    receivables.reduce((sum, row) => sum + row.outstanding, 0)
  );

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
    receivableAmount,
    receivableCollected,
    receivableOutstanding: receivableOutstandingTotal,
    receivables,
    paymentType: p.paymentType,
    paymentTypeLabel: PURCHASE_PAYMENT_TYPE_LABELS[p.paymentType] || p.paymentType,
    creditLedgerEntryId: p.creditLedgerEntries[0]?.id ?? null,
  };
}

function isPurchaseFullySettled(row: {
  outstanding: number;
  receivableOutstanding: number;
}) {
  return row.outstanding <= 0.0001 && row.receivableOutstanding <= 0.0001;
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

  const [purchases, receivableRecords] = await Promise.all([
    prisma.purchase.findMany({
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
    }),
    prisma.purchaseSupplierReceivable.findMany({
      where: {
        branchId: auth.branchId,
        ...(supplierKindFilter && {
          supplier: { supplierKind: supplierKindFilter },
        }),
      },
      include: {
        purchaseReturn: { select: { returnNumber: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const receivablesByPurchase = new Map<
    string,
    {
      id: string;
      returnNumber: string;
      amount: number;
      collectedAmount: number;
      outstanding: number;
    }[]
  >();

  for (const record of receivableRecords) {
    const line = {
      id: record.id,
      returnNumber: record.purchaseReturn.returnNumber,
      amount: record.amount,
      collectedAmount: record.collectedAmount,
      outstanding: receivableOutstanding(record.amount, record.collectedAmount),
    };
    const list = receivablesByPurchase.get(record.purchaseId) ?? [];
    list.push(line);
    receivablesByPurchase.set(record.purchaseId, list);
  }

  const cashPurchaseIds = [...receivablesByPurchase.entries()]
    .filter(([, lines]) => lines.some((line) => line.outstanding > 0.0001))
    .map(([purchaseId]) => purchaseId)
    .filter((purchaseId) => !purchases.some((p) => p.id === purchaseId));

  const cashPurchasesWithReceivable =
    cashPurchaseIds.length > 0
      ? await prisma.purchase.findMany({
          where: {
            branchId: auth.branchId,
            status: "completed",
            paymentType: "full_cash",
            id: { in: cashPurchaseIds },
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
        })
      : [];

  const allPurchases = [...purchases, ...cashPurchasesWithReceivable];

  let rows = allPurchases.map((purchase) =>
    mapDebtRow(purchase, receivablesByPurchase.get(purchase.id) ?? [])
  );

  const supplierOptions = Array.from(
    new Map(
      rows.map((r) => [
        r.supplierId,
        { id: r.supplierId, nameAr: r.supplierName, phone: r.supplierPhone },
      ])
    ).values()
  ).sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));

  if (supplierId) {
    rows = rows.filter((r) => r.supplierId === supplierId);
  }

  if (search) {
    rows = rows.filter(
      (r) =>
        r.invoiceNumber.includes(search) ||
        r.supplierName.includes(search) ||
        (r.supplierPhone?.includes(search) ?? false) ||
        r.receivables.some((recv) => recv.returnNumber.includes(search))
    );
  }

  const outstandingRows = rows.filter((r) => !isPurchaseFullySettled(r));
  const settledRows = rows.filter((r) => isPurchaseFullySettled(r));

  const outstandingTotals = outstandingRows.reduce(
    (acc, row) => {
      acc.totalAmount += row.total;
      acc.paidAmount += row.paidAmount;
      acc.outstanding += row.outstanding;
      return acc;
    },
    { totalAmount: 0, paidAmount: 0, outstanding: 0 }
  );

  const receivableTotalsAll = rows.reduce(
    (acc, row) => {
      acc.amount += row.receivableAmount;
      acc.collectedAmount += row.receivableCollected;
      acc.outstanding += row.receivableOutstanding;
      return acc;
    },
    { amount: 0, collectedAmount: 0, outstanding: 0 }
  );

  return NextResponse.json({
    outstandingRows,
    settledRows,
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
