import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/api-auth";
import { computeInventoryStockValueSnapshot } from "@/lib/inventory-stock-value-display";
import { isFullAccessRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  if (!isFullAccessRole(auth.role)) {
    return forbiddenResponse("هذه الميزة تتطلب حساب أدمن أو سوبر أدمن");
  }

  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!password.trim()) {
      return NextResponse.json({ message: "كلمة المرور مطلوبة" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id: auth.userId, companyId: auth.companyId, isActive: true },
      select: { id: true, passwordHash: true, role: true },
    });

    if (!user || !isFullAccessRole(user.role)) {
      return forbiddenResponse("هذه الميزة تتطلب حساب أدمن أو سوبر أدمن");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const snapshot = await computeInventoryStockValueSnapshot(
      prisma,
      auth.branchId,
      auth.companyId
    );

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("POST /api/inventory/stock-value failed:", error);
    return NextResponse.json({ message: "تعذر تحميل قيمة المخزون" }, { status: 500 });
  }
}
