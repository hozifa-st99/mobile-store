import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { readPurchaseItemReturnFields, readPurchaseReturnStatus } from "@/lib/purchase-item-return-fields";
import { readUnitPriceBeforeByItemIds } from "@/lib/purchase-item-price-before";
import { readInvoiceScopedEffectiveUnitPrices } from "@/lib/purchase-item-cost-adjustments";
import { splitExpenseNotes } from "@/lib/purchase-invoice-notes";
import {
  resolveLineReturnPricing,
} from "@/lib/purchase-return-expense";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";

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
        include: { product: { select: { id: true, type: true, barcode: true } } },
      },
    },
  });

  if (!purchase) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const returnFields = await readPurchaseItemReturnFields(
    prisma,
    purchase.items.map((i) => i.id)
  );
  const returnStatusMap = await readPurchaseReturnStatus(prisma, [purchase.id]);
  const returnStatus = returnStatusMap[purchase.id] ?? "none";
  const priceBeforeMap = await readUnitPriceBeforeByItemIds(
    prisma,
    purchase.items.map((i) => i.id)
  );
  const effectiveAfterMap = await readInvoiceScopedEffectiveUnitPrices(
    prisma,
    purchase.items.map((i) => ({
      id: i.id,
      unitPrice: i.unitPrice,
    }))
  );
  const { expenseLine } = splitExpenseNotes(purchase.notes);
  const pricingItems = purchase.items.map((i) => ({
    id: i.id,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

  const items = await Promise.all(
    purchase.items.map(async (item) => {
      const fields = returnFields[item.id] ?? { returnedQuantity: 0, imeisSnapshot: null };
      const returnableQuantity = Math.max(0, item.quantity - fields.returnedQuantity);
      const imeis = parseImeisSnapshot(fields.imeisSnapshot);
      const isPhone = item.product?.type === "phone";

      let imeiDetails: { imei: string; status: string; cycleIndex?: number }[] = [];
      let lineSerialStatus: string | null = null;
      let lineCycleIndex: number | undefined;

      if (isPhone && imeis.length > 0) {
        const lineSerial = await prisma.productSerial.findFirst({
          where: { branchId: auth.branchId, purchaseItemId: item.id },
          select: {
            status: true,
            cycleIndex: true,
            imeiEntries: { select: { imei: true } },
          },
        });

        lineSerialStatus = lineSerial?.status ?? "missing";
        lineCycleIndex = lineSerial?.cycleIndex;
        imeiDetails = imeis.map((imei) => ({
          imei,
          status: lineSerialStatus ?? "missing",
          cycleIndex: lineCycleIndex,
        }));
      }

      const canReturn =
        purchase.status === "completed" &&
        returnableQuantity > 0 &&
        returnStatus !== "full" &&
        (!isPhone || (imeis.length > 0 && lineSerialStatus === "available"));

      let blockReason: string | null = null;
      if (purchase.status !== "completed") blockReason = "الفاتورة غير مكتملة";
      else if (returnableQuantity <= 0) blockReason = "تم إرجاع هذا الصنف بالكامل";
      else if (isPhone && imeis.length === 0)
        blockReason = "لا يوجد سجل IMEI — لا يمكن إرجاع الموبايل";
      else if (isPhone && lineSerialStatus === "sold")
        blockReason = "الجهاز مباع — لا يمكن الإرجاع";
      else if (isPhone && lineSerialStatus !== "available")
        blockReason = "IMEI غير متاح في المخزون";

      const pricing = resolveLineReturnPricing(
        { id: item.id, quantity: item.quantity, unitPrice: item.unitPrice },
        pricingItems,
        priceBeforeMap[item.id] ?? null,
        expenseLine,
        returnableQuantity
      );

      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        returnedQuantity: fields.returnedQuantity,
        returnableQuantity,
        unitPrice: item.unitPrice,
        unitPriceBefore: pricing.unitPriceBefore,
        unitPriceAfter: effectiveAfterMap[item.id] ?? pricing.unitPriceAfter,
        hasExpenseLine: pricing.hasExpenseLine,
        refundUnitPrice: pricing.refundUnitPrice,
        expensePerUnit: pricing.expensePerUnit,
        total: item.total,
        productId: item.productId,
        isPhone,
        barcode:
          item.barcode?.trim() ||
          (!isPhone ? item.product?.barcode?.trim() || null : null),
        imeis: imeiDetails,
        canReturn,
        blockReason,
      };
    })
  );

  const hasExpenses = items.some(
    (i) => Math.abs(i.unitPriceBefore - i.unitPriceAfter) > 0.001
  );

  const creditEntry = await prisma.creditLedgerEntry.findFirst({
    where: { purchaseId: id },
    select: { creditAmount: true, paidAmount: true },
  });
  const creditOutstanding = creditEntry
    ? Math.max(0, Math.round((creditEntry.creditAmount - creditEntry.paidAmount) * 100) / 100)
    : 0;

  return NextResponse.json({
    purchase: {
      id: purchase.id,
      invoiceNumber: purchase.invoiceNumber,
      purchaseDate: purchase.purchaseDate,
      status: purchase.status,
      returnStatus,
      total: purchase.total,
      paymentType: purchase.paymentType,
      creditOutstanding,
      expenseLine,
      hasExpenses,
      supplier: purchase.supplier,
    },
    items,
    canReturnAny: items.some((i) => i.canReturn),
    hasExpenses,
  });
}
