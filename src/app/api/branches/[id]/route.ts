import { NextRequest, NextResponse } from "next/server";

import { requireUserManager } from "@/lib/api-auth";
import {
  branchHasActivity,
  formatBranchForClient,
  normalizeBranchCodeInput,
  validateBranchCode,
} from "@/lib/branch-service";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const { id } = await context.params;
  const body = await request.json();

  const branch = await prisma.branch.findFirst({
    where: { id, companyId: auth.companyId },
  });

  if (!branch) {
    return NextResponse.json({ message: "الفرع غير موجود" }, { status: 404 });
  }

  const hasActivity = await branchHasActivity(prisma, branch.id);
  const data: {
    nameAr?: string;
    name?: string;
    code?: string;
    address?: string | null;
    phone?: string | null;
    isActive?: boolean;
  } = {};

  if (body.nameAr !== undefined) {
    const nameAr = String(body.nameAr).trim();
    if (!nameAr) {
      return NextResponse.json({ message: "اسم الفرع مطلوب" }, { status: 400 });
    }
    data.nameAr = nameAr;
    data.name = nameAr;
  }

  if (body.address !== undefined) {
    data.address = body.address ? String(body.address).trim() : null;
  }

  if (body.phone !== undefined) {
    data.phone = body.phone ? String(body.phone).trim() : null;
  }

  if (body.code !== undefined) {
    if (hasActivity) {
      return NextResponse.json(
        { message: "لا يمكن تغيير كود الفرع بعد وجود فواتير أو مخزون" },
        { status: 400 }
      );
    }
    const codeError = validateBranchCode(String(body.code));
    if (codeError) {
      return NextResponse.json({ message: codeError }, { status: 400 });
    }
    data.code = normalizeBranchCodeInput(String(body.code));
  }

  if (body.isActive === false) {
    const activeCount = await prisma.branch.count({
      where: { companyId: auth.companyId, isActive: true, id: { not: id } },
    });
    if (activeCount === 0) {
      return NextResponse.json({ message: "يجب أن يبقى فرع واحد نشط على الأقل" }, { status: 400 });
    }
    data.isActive = false;
  }

  if (body.isActive === true) {
    data.isActive = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "لا توجد تغييرات" }, { status: 400 });
  }

  try {
    const updated = await prisma.branch.update({
      where: { id: branch.id },
      data,
    });

    return NextResponse.json({
      branch: {
        ...formatBranchForClient(updated),
        hasActivity,
        codeLocked: hasActivity,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ message: "كود الفرع مستخدم بالفعل" }, { status: 409 });
    }
    console.error("branch update:", e);
    return NextResponse.json({ message: "تعذر تحديث الفرع" }, { status: 500 });
  }
}
