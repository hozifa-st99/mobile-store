import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import {
  readReturnedQuantitiesBySaleItemIds,
  readSaleReturnStatus,
} from "@/lib/sale-item-return-fields";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  const sale = await prisma.sale.findFirst({
    where: { id, branchId: auth.branchId },
    include: {
      customer: true,
      items: {
        include: { product: { select: { type: true, barcode: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  if (sale.status !== "completed") {
    return NextResponse.json({ message: "الفاتورة غير مكتملة" }, { status: 400 });
  }

  const returnedMap = await readReturnedQuantitiesBySaleItemIds(
    prisma,
    sale.items.map((i) => i.id)
  );
  const returnStatusMap = await readSaleReturnStatus(prisma, [sale.id]);
  const returnStatus = returnStatusMap[sale.id] ?? "none";

  const items = sale.items.map((item) => {
    const returnedQuantity = returnedMap[item.id] ?? 0;
    const returnableQuantity = Math.max(0, item.quantity - returnedQuantity);
    const isPhone = item.product?.type === "phone";

    let canReturn = returnableQuantity > 0;
    let blockReason: string | null = null;

    if (returnStatus === "full") {
      canReturn = false;
      blockReason = "تم إرجاع الفاتورة بالكامل";
    } else if (returnableQuantity <= 0) {
      canReturn = false;
      blockReason = "تم إرجاع هذا السطر بالكامل";
    } else if (isPhone && !item.imei && !item.barcode) {
      canReturn = false;
      blockReason = "لا يوجد IMEI/باركود — لا يمكن إرجاع الموبايل";
    }

    return {
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      returnedQuantity,
      returnableQuantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      total: item.total,
      imei: item.imei,
      barcode: item.barcode ?? (!isPhone ? item.product?.barcode ?? null : null),
      isPhone,
      canReturn,
      blockReason,
    };
  });

  const canReturnAny = items.some((i) => i.canReturn);

  return NextResponse.json({
    sale: {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      total: sale.total,
      subtotal: sale.subtotal,
      discount: sale.discount,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      returnStatus,
      customer: sale.customer
        ? { nameAr: sale.customer.nameAr }
        : { nameAr: "عميل نقدي" },
    },
    items,
    canReturnAny,
  });
}
