import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveReportRange } from "@/lib/report-dates";
import { listTreasuryShifts } from "@/lib/treasury-shift";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const range = resolveReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });

  const from = new Date(range.from);
  const to = new Date(range.to);

  try {
    const { shifts, summary } = await listTreasuryShifts(auth.branchId, from, to);

    return NextResponse.json(
      { range, shifts, summary },
      { headers: { "Cache-Control": "private, max-age=15" } }
    );
  } catch (error) {
    console.error("treasury shifts list error:", error);
    return NextResponse.json({ message: "تعذر تحميل سجل التوريدات" }, { status: 500 });
  }
}
