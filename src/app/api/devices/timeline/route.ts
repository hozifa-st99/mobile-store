import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getImeiTimeline, normalizeImeiSearchInput } from "@/lib/imei-timeline";
import { isValidImeiFormat } from "@/lib/product-serial-imeis";

/** تتبع IMEI — عرض فقط */
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const raw = (new URL(request.url).searchParams.get("imei") || "").trim();
  if (!raw) {
    return NextResponse.json({ message: "أدخل رقم IMEI" }, { status: 400 });
  }

  const imei = normalizeImeiSearchInput(raw);
  if (!isValidImeiFormat(imei)) {
    return NextResponse.json({ message: "رقم IMEI غير صالح" }, { status: 400 });
  }

  const timeline = await getImeiTimeline(auth.branchId, imei);
  if (!timeline) {
    return NextResponse.json({ message: "لا يوجد سجل لهذا الرقم في الفرع الحالي" }, { status: 404 });
  }

  return NextResponse.json({ timeline });
}
