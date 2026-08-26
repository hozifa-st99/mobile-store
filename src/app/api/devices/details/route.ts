import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  mapSerialToPhoneDeviceRow,
  phoneSerialDetailsInclude,
} from "@/lib/phone-device-serial-details";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";
import {
  findDeviceSerialByBarcode,
  findDeviceSerialByImei,
} from "@/lib/product-serial-service";

/** تفاصيل جهاز متاح — للعرض في فاتورة البيع */
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ message: "أدخل IMEI أو باركود" }, { status: 400 });
  }

  const serialByImei = await findDeviceSerialByImei(prisma, auth.branchId, q, { status: "available" });
  const serialMatch =
    serialByImei ||
    (await findDeviceSerialByBarcode(prisma, auth.branchId, q, { status: "available" }));

  if (!serialMatch) {
    return NextResponse.json({ message: "الجهاز غير موجود أو غير متاح" }, { status: 404 });
  }

  const serial = await prisma.productSerial.findUnique({
    where: { id: serialMatch.id },
    include: phoneSerialDetailsInclude(auth.branchId),
  });

  if (!serial || !serialBelongsToProduct(serial, serial.productId)) {
    return NextResponse.json({ message: "الجهاز غير موجود أو غير متاح" }, { status: 404 });
  }

  return NextResponse.json({ device: mapSerialToPhoneDeviceRow(serial) });
}
