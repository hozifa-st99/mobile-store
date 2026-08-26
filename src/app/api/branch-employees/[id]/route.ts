import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { id } = await context.params;
    const { nameAr, phone, address, isActive } = await request.json();

    const existing = await prisma.branchEmployee.findFirst({
      where: { id, branchId: auth.branchId },
    });
    if (!existing) {
      return NextResponse.json({ message: "الموظف غير موجود" }, { status: 404 });
    }

    if (nameAr !== undefined && !nameAr?.trim()) {
      return NextResponse.json({ message: "اسم الموظف مطلوب" }, { status: 400 });
    }

    const employee = await prisma.branchEmployee.update({
      where: { id },
      data: {
        ...(nameAr !== undefined ? { nameAr: nameAr.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("[branch-employees PUT]", error);
    return NextResponse.json({ message: "تعذّر تحديث بيانات الموظف" }, { status: 500 });
  }
}
