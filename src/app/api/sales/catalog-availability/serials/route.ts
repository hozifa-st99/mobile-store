import { NextRequest, NextResponse } from "next/server";

import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { loadCatalogAvailabilitySerials } from "@/lib/catalog-availability-serials-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const productId = request.nextUrl.searchParams.get("productId")?.trim() || "";
  const phoneModelId = request.nextUrl.searchParams.get("phoneModelId")?.trim() || "";
  const branchId = request.nextUrl.searchParams.get("branchId")?.trim() || "";
  const excludeBranchId = request.nextUrl.searchParams.get("excludeBranchId")?.trim() || "";
  const title = request.nextUrl.searchParams.get("title")?.trim() || "";
  const subtitle = request.nextUrl.searchParams.get("subtitle")?.trim() || "";

  if (!productId && !phoneModelId) {
    return NextResponse.json({ message: "حدد المنتج أو الموديل" }, { status: 400 });
  }

  try {
    const payload = await loadCatalogAvailabilitySerials(prisma, auth.companyId, {
      productId: productId || undefined,
      phoneModelId: phoneModelId || undefined,
      branchId: branchId || undefined,
      excludeBranchId: excludeBranchId || undefined,
      title: title || undefined,
      subtitle: subtitle || undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("catalog availability serials error:", error);
    return NextResponse.json({ message: "تعذر تحميل تفاصيل الأجهزة" }, { status: 500 });
  }
}
