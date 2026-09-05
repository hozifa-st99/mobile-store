import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { readSaleReturnStatus } from "@/lib/sale-item-return-fields";
import { attachInvoiceCreators } from "@/lib/invoice-creator-server";
import {
  mapSerialToPhoneDeviceRow,
  phoneSerialDetailsInclude,
} from "@/lib/phone-device-serial-details";
import {
  saleInvoicePhoneDisplayFromDeviceRow,
  saleInvoicePhoneDisplayFromProduct,
} from "@/lib/sale-invoice-phone-display";

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
        include: {
          product: {
            select: {
              type: true,
              barcode: true,
              color: true,
              storage: true,
              deviceCondition: true,
              boxCondition: true,
              batteryPercent: true,
              taxStatus: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const [saleWithCreator] = await attachInvoiceCreators(prisma, [sale]);

  const phoneSerialIds = saleWithCreator.items
    .map((item) => item.serialId)
    .filter((serialId): serialId is string => Boolean(serialId));

  const phoneSerialRows =
    phoneSerialIds.length > 0
      ? await prisma.productSerial.findMany({
          where: { id: { in: phoneSerialIds }, branchId: auth.branchId },
          include: phoneSerialDetailsInclude(auth.branchId),
        })
      : [];

  const phoneSerialDisplayById = new Map(
    phoneSerialRows.map((serial) => [
      serial.id,
      saleInvoicePhoneDisplayFromDeviceRow(mapSerialToPhoneDeviceRow(serial)),
    ])
  );

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
        const phoneDisplay =
          isPhone && item.product
            ? item.serialId
              ? phoneSerialDisplayById.get(item.serialId) ??
                saleInvoicePhoneDisplayFromProduct(item.product)
              : saleInvoicePhoneDisplayFromProduct(item.product)
            : null;

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
          phoneDisplay,
        };
      }),
    },
    returns,
  });
}
