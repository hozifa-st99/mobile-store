import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getTreasuryShiftDetails } from "@/lib/treasury-shift";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const details = await getTreasuryShiftDetails(auth.branchId, id);
    if (!details) {
      return NextResponse.json({ message: "الوردية غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ details });
  } catch (error) {
    console.error("treasury shift details error:", error);
    return NextResponse.json({ message: "تعذر تحميل تفاصيل الوردية" }, { status: 500 });
  }
}
