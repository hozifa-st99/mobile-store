import { NextRequest, NextResponse } from "next/server";

import { loadCatalogAvailabilitySerialDetails } from "@/lib/catalog-availability-serial-details-server";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** تفاصيل جهاز متاح (أي فرع) — للاستعلام عن المخزون، بدون سعر الشراء */
export async function GET(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const serialId = request.nextUrl.searchParams.get("serialId")?.trim() || "";
  if (!serialId) {
    return NextResponse.json({ message: "حدد الجهاز" }, { status: 400 });
  }

  try {
    const device = await loadCatalogAvailabilitySerialDetails(prisma, auth.companyId, serialId);
    if (!device) {
      return NextResponse.json({ message: "الجهاز غير موجود أو غير متاح" }, { status: 404 });
    }
    return NextResponse.json({ device });
  } catch (error) {
    console.error("catalog availability serial details error:", error);
    return NextResponse.json({ message: "تعذر تحميل تفاصيل الجهاز" }, { status: 500 });
  }
}
