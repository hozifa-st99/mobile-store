import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  mapSerialToPhoneDeviceRow,
  phoneSerialDetailsInclude,
} from "@/lib/phone-device-serial-details";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const brand = searchParams.get("brand")?.trim() || "";
  const deviceCondition = searchParams.get("deviceCondition")?.trim() || "";

  const productWhere: Record<string, unknown> = {
    type: "phone",
    deletedAt: null,
    isActive: true,
    companyId: auth.companyId,
    ...(brand ? { brand } : {}),
    ...(deviceCondition === "new" || deviceCondition === "used" ? { deviceCondition } : {}),
  };

  const serialWhere: Record<string, unknown> = {
    branchId: auth.branchId,
    status: "available",
    product: productWhere,
  };

  if (search) {
    serialWhere.OR = [
      { imeiEntries: { some: { imei: { contains: search } } } },
      { barcode: { contains: search } },
      {
        product: {
          OR: [
            { nameAr: { contains: search } },
            { brand: { contains: search } },
            { barcode: { contains: search } },
            { color: { contains: search } },
            { storage: { contains: search } },
            { phoneModel: { is: { nameAr: { contains: search } } } },
            { phoneBrand: { is: { nameAr: { contains: search } } } },
          ],
        },
      },
    ];
  }

  const serials = await prisma.productSerial.findMany({
    where: serialWhere,
    include: phoneSerialDetailsInclude(auth.branchId),
    orderBy: [{ product: { nameAr: "asc" } }, { createdAt: "desc" }],
  });

  const devices = serials
    .filter((serial) => serialBelongsToProduct(serial, serial.productId))
    .map((serial) => mapSerialToPhoneDeviceRow(serial));

  const brands = await prisma.product.findMany({
    where: {
      companyId: auth.companyId,
      type: "phone",
      deletedAt: null,
      isActive: true,
      serials: { some: { branchId: auth.branchId, status: "available" } },
    },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });

  return NextResponse.json({
    devices,
    brands: brands.map((row) => row.brand),
  });
}
