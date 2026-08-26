import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getSerialEffectiveRetailPrice } from "@/lib/phone-serial-pricing";
import {
  findDeviceSerialByBarcode,
  findDeviceSerialByImei,
} from "@/lib/product-serial-service";
import { formatDeviceImeisLabel, getDeviceImeis } from "@/lib/product-serial-imeis";

/** البحث عن جهاز متاح للبيع بالـ IMEI أو الباركود */
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ message: "أدخل IMEI أو باركود" }, { status: 400 });
  }

  const serialByImei = await findDeviceSerialByImei(prisma, auth.branchId, q, { status: "available" });
  const serial =
    serialByImei ||
    (await findDeviceSerialByBarcode(prisma, auth.branchId, q, { status: "available" }));

  if (!serial) {
    return NextResponse.json({ message: "الجهاز غير موجود أو مباع" }, { status: 404 });
  }

  const product = await prisma.product.findUnique({
    where: { id: serial.productId },
    include: {
      inventories: {
        where: { branchId: auth.branchId },
        take: 1,
      },
    },
  });

  if (!product) {
    return NextResponse.json({ message: "الجهاز غير موجود أو مباع" }, { status: 404 });
  }

  const inv = product.inventories[0];
  const imeis = getDeviceImeis(serial);
  const scannedImei = serialByImei ? q.trim() : (imeis[0] ?? null);
  const retailPrice = getSerialEffectiveRetailPrice(
    {
      unitCost: serial.unitCost,
      retailPrice: serial.retailPrice,
    },
    inv?.retailPrice ?? 0
  );

  return NextResponse.json({
    device: {
      productId: serial.productId,
      name: product.nameAr,
      brand: product.brand,
      type: product.type,
      imei: scannedImei,
      scannedImei,
      imeis,
      imeiLabel: formatDeviceImeisLabel(imeis),
      barcode: serial.barcode,
      retailPrice,
      unitCost: serial.unitCost > 0.001 ? serial.unitCost : inv?.purchasePrice ?? 0,
    },
  });
}
