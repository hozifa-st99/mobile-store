import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { listDepositedExpenses } from "@/lib/expense-deposits";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);

  try {
    const result = await listDepositedExpenses(auth.branchId, {
      period: searchParams.get("period"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      month: searchParams.get("month"),
      shiftId: searchParams.get("shiftId"),
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (error) {
    console.error("deposited expenses error:", error);
    return NextResponse.json({ message: "تعذر تحميل المصروفات السابقة" }, { status: 500 });
  }
}
