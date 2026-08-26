import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { loadStocktakeLines } from "@/lib/stocktake-lines";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ lines: [] });
  }

  try {
    const lines = await loadStocktakeLines(auth.branchId, auth.companyId, { search: q });
    return NextResponse.json({ lines: lines.slice(0, 20) });
  } catch (error) {
    console.error("stocktake search:", error);
    return NextResponse.json({ message: "تعذر البحث عن الصنف" }, { status: 500 });
  }
}
