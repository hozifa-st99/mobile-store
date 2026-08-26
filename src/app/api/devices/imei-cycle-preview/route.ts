import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { previewImeiCycleEntry } from "@/lib/device-cycle";
import { prisma } from "@/lib/prisma";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const imeiParam = request.nextUrl.searchParams.get("imei")?.trim();
  if (!imeiParam) {
    return NextResponse.json({ message: "IMEI مطلوب" }, { status: 400 });
  }

  const imeis = parseImeisSnapshot(imeiParam);
  if (imeis.length === 0) {
    return NextResponse.json({ message: "IMEI غير صالح" }, { status: 400 });
  }

  try {
    const preview = await previewImeiCycleEntry(prisma, auth.branchId, imeis);
    return NextResponse.json({ preview });
  } catch (error) {
    console.error("imei-cycle-preview error:", error);
    return NextResponse.json({ message: "تعذر التحقق من IMEI" }, { status: 500 });
  }
}
