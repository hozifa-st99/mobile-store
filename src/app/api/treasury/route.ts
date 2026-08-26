import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { buildTreasuryShiftView } from "@/lib/treasury-shift";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 300));

  try {
    const view = await buildTreasuryShiftView(auth.branchId, {
      dateFrom,
      dateTo,
      depositedLimit: limit,
    });

    return NextResponse.json({
      openShift: view.openShift,
      deposited: view.deposited,
      currentBalance: view.currentBalance,
    });
  } catch (error) {
    console.error("treasury ledger error:", error);
    return NextResponse.json({ message: "تعذر تحميل سجل الخزنة" }, { status: 500 });
  }
}
