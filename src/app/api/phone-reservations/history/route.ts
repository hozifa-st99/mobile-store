import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, requireScreenAccess, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { listPhoneReservationHistory } from "@/lib/phone-reservation-service";

/** سجل الحجوزات المنتهية — استعلام وعرض فقط */
export async function GET(request: NextRequest) {
  const { error: accessError } = await requireScreenAccess(request, "phone_reservations");
  if (accessError) return accessError;

  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const search = request.nextUrl.searchParams.get("search")?.trim() || "";

  try {
    const history = await listPhoneReservationHistory(prisma, auth.branchId, search);
    return NextResponse.json({ history });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "تعذّر تحميل سجل الحجوزات" }, { status: 500 });
  }
}
