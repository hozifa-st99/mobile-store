import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getProductPurchaseHistory } from "@/lib/inventory-purchase-history";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { productId } = await params;

  try {
    const history = await getProductPurchaseHistory(auth.branchId, auth.companyId, productId);
    if (!history) {
      return NextResponse.json({ message: "المنتج غير موجود في المخزون" }, { status: 404 });
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error("inventory purchase history error:", error);
    return NextResponse.json({ message: "تعذر تحميل تقرير أسعار الشراء" }, { status: 500 });
  }
}
