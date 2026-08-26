import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { closeTreasuryShift } from "@/lib/treasury-shift";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const result = await closeTreasuryShift(auth.branchId, auth.userId);
    return NextResponse.json({
      message: `تم تقفيل الوردية ${result.shiftNumber}`,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_PENDING_ENTRIES") {
      return NextResponse.json({ message: "لا توجد حركات لم تُورد بعد" }, { status: 400 });
    }
    console.error("close treasury shift error:", error);
    return NextResponse.json({ message: "تعذر تقفيل الوردية" }, { status: 500 });
  }
}
