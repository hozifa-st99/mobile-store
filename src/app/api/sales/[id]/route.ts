import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { readSaleReturnStatus } from "@/lib/sale-item-return-fields";
import { attachInvoiceCreators } from "@/lib/invoice-creator-server";

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
      customer: { select: { nameAr: true, phone: true } },
      items: {
        include: { product: { select: { type: true, barcode: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const [saleWithCreator] = await attachInvoiceCreators(prisma, [sale]);

  let returnStatus = "none";
  let returns: {
    id: string;
    returnNumber: string;
    returnDate: Date;
    subtotal: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    notes: string | null;
    userName: string | null;
    items: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      imei: string | null;
      barcode: string | null;
    }[];
  }[] = [];

  try {
    const [returnStatusMap, returnRows] = await Promise.all([
      readSaleReturnStatus(prisma, [saleWithCreator.id]),
      prisma.saleReturn.findMany({
        where: { saleId: saleWithCreator.id, branchId: auth.branchId },
        include: {
          user: { select: { fullNameAr: true, username: true } },
          items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              total: true,
              imei: true,
              barcode: true,
            },
          },
        },
        orderBy: { returnDate: "asc" },
      }),
    ]);
    returnStatus = returnStatusMap[saleWithCreator.id] ?? "none";
    returns = returnRows.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      returnDate: r.returnDate,
      subtotal: r.subtotal,
      discount: r.discount,
      taxRate: r.taxRate,
      taxAmount: r.taxAmount,
      total: r.total,
      notes: r.notes,
      userName: r.user?.fullNameAr || r.user?.username || null,
      items: r.items,
    }));
  } catch (err) {
    console.error("Sale returns load error:", err);
  }

  return NextResponse.json({
    sale: {
      ...saleWithCreator,
      returnStatus,
      items: saleWithCreator.items.map((item) => {
        const isPhone = item.product?.type === "phone";
        return {
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          total: item.total,
          imei: item.imei,
          barcode: item.barcode ?? (!isPhone ? item.product?.barcode ?? null : null),
          isPhone,
        };
      }),
    },
    returns,
  });
}
