import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { loadProductRetailPriceHistory } from "@/lib/retail-price-history";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const history = await loadProductRetailPriceHistory(auth.branchId, id);
    if (!history) {
      return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Retail price history error:", error);
    return NextResponse.json({ message: "حدث خطأ" }, { status: 500 });
  }
}
