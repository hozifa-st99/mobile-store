import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { loadStocktakeLines } from "@/lib/stocktake-lines";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";

  try {
    const lines = await loadStocktakeLines(auth.branchId, auth.companyId, { search });
    return NextResponse.json({ lines });
  } catch (error) {
    console.error("stocktake lines:", error);
    return NextResponse.json({ message: "تعذر تحميل أصناف الجرد" }, { status: 500 });
  }
}
