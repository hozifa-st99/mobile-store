import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserManager } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const branches = await prisma.branch.findMany({
    where: { companyId: auth.companyId, isActive: true },
    select: { id: true, nameAr: true, code: true },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({
    branches: branches.map((b) => ({
      id: b.id,
      name: b.nameAr,
      code: b.code,
    })),
  });
}
