import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { readUnitPriceBeforeByItemIds } from "@/lib/purchase-item-price-before";
import { readEffectiveUnitPricesAfter } from "@/lib/purchase-item-cost-adjustments";
import { splitExpenseNotes } from "@/lib/purchase-invoice-notes";
import { resolveLineReturnPricing } from "@/lib/purchase-return-expense";
import { readPurchaseReturnStatus } from "@/lib/purchase-item-return-fields";
import { attachInvoiceCreators } from "@/lib/invoice-creator-server";
import { purchaseDebtDisplayOutstanding } from "@/lib/purchase-payment-display";

const expenseHandlingLabels: Record<string, string> = {
  redistribute: "توزيع على الباقي",
  daily_expense: "مصروف يومي",
  partial_recovery: "استرداد جزئي",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  const purchase = await prisma.purchase.findFirst({
    where: { id, branchId: auth.branchId },
    include: {
      supplier: true,
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!purchase) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const [purchaseWithCreator] = await attachInvoiceCreators(prisma, [purchase]);

  const beforeMap = await readUnitPriceBeforeByItemIds(
    prisma,
    purchase.items.map((item) => item.id)
  );
  const effectiveAfterMap = await readEffectiveUnitPricesAfter(
    prisma,
    purchase.items.map((item) => ({
      id: item.id,
      unitPrice: item.unitPrice,
      productId: item.productId,
    })),
    auth.branchId
  );
  const { expenseLine } = splitExpenseNotes(purchase.notes);
  const pricingItems = purchase.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  let returnStatus: string = "none";
  type PurchaseReturnRow = Awaited<
    ReturnType<
      typeof prisma.purchaseReturn.findMany<{
        include: {
          user: { select: { fullNameAr: true; username: true } };
          items: {
            select: {
              id: true;
              description: true;
              quantity: true;
              unitPrice: true;
              total: true;
              imeisSnapshot: true;
            };
          };
        };
      }>
    >
  >[number];
  let returns: PurchaseReturnRow[] = [];

  try {
    const [returnStatusMap, returnRows] = await Promise.all([
      readPurchaseReturnStatus(prisma, [purchase.id]),
      prisma.purchaseReturn.findMany({
        where: { purchaseId: purchase.id, branchId: auth.branchId },
        include: {
          user: { select: { fullNameAr: true, username: true } },
          items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              total: true,
              imeisSnapshot: true,
            },
          },
        },
        orderBy: { returnDate: "asc" },
      }),
    ]);
    returnStatus = returnStatusMap[purchase.id] ?? "none";
    returns = returnRows;
  } catch (err) {
    console.error("Purchase returns load error:", err);
  }

  const creditEntry = await prisma.creditLedgerEntry.findFirst({
    where: { purchaseId: purchase.id },
    select: { creditAmount: true, paidAmount: true },
  });
  const creditOutstanding = ["credit", "partial_credit"].includes(purchase.paymentType)
    ? purchaseDebtDisplayOutstanding(purchase, creditEntry)
    : 0;

  return NextResponse.json({
    purchase: {
      ...purchaseWithCreator,
      returnStatus,
      creditOutstanding,
      items: purchaseWithCreator.items.map((item) => {
        const inferred = resolveLineReturnPricing(
          { id: item.id, quantity: item.quantity, unitPrice: item.unitPrice },
          pricingItems,
          beforeMap[item.id] ?? null,
          expenseLine,
          item.quantity
        );
        const unitPriceBefore =
          beforeMap[item.id] ??
          (inferred.hasExpenseLine ? inferred.unitPriceBefore : null);
        return {
          ...item,
          unitPriceBefore,
          effectiveUnitPrice: effectiveAfterMap[item.id] ?? item.unitPrice,
        };
      }),
    },
    returns: returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      returnDate: r.returnDate,
      subtotal: r.subtotal,
      total: r.total,
      notes: r.notes,
      expenseHandling: r.expenseHandling
        ? expenseHandlingLabels[r.expenseHandling] ?? r.expenseHandling
        : null,
      expenseAmount: r.expenseAmount,
      expenseRecoveredAmount: r.expenseRecoveredAmount,
      userName: r.user?.fullNameAr || r.user?.username || null,
      items: r.items,
    })),
  });
}
