import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const categories = await prisma.productCategory.findMany({
    where: { companyId: auth.companyId },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({ categories });
}
