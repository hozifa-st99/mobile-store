import { NextRequest, NextResponse } from "next/server";

import {
  getAuthFromRequest,
  getCompanyAuthFromRequest,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { loadCatalogAvailability } from "@/lib/catalog-availability-server";
import { prisma } from "@/lib/prisma";
import { getBranchesForUser } from "@/lib/user-permissions-service";

export async function GET(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const branchIdParam = request.nextUrl.searchParams.get("branchId")?.trim();
  const branchAuth = await getAuthFromRequest(request);

  let branchId = branchIdParam || branchAuth?.branchId || null;

  if (!branchId) {
    const branches = await getBranchesForUser(auth.userId, auth.role, auth.companyId);
    branchId = branches[0]?.id ?? null;
  }

  if (!branchId) {
    return NextResponse.json({ message: "لا توجد فروع متاحة" }, { status: 404 });
  }

  try {
    const payload = await loadCatalogAvailability(prisma, auth.companyId, branchId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("catalog availability error:", error);
    return NextResponse.json({ message: "تعذر تحميل توفر المنتجات" }, { status: 500 });
  }
}
