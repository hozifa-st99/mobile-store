import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";
import { requireUserManager } from "@/lib/api-auth";
import {
  getBranchesForUser,
  replaceUserBranches,
  replaceUserScreenPermissions,
} from "@/lib/user-permissions-service";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const target = await prisma.user.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
      isHidden: false,
    },
  });

  if (!target) {
    return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
  }

  const body = await request.json();
  const {
    password,
    fullNameAr,
    fullName,
    email,
    phone,
    role,
    branchIds = [],
    screenPermissions = [],
  } = body;

  if (role && role !== ROLES.ADMIN && role !== ROLES.EMPLOYEE) {
    return NextResponse.json({ message: "الدور غير مسموح" }, { status: 400 });
  }

  const data: {
    fullNameAr?: string;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    role?: string;
    passwordHash?: string;
    isActive?: boolean;
  } = {};

  if (fullNameAr) {
    data.fullNameAr = fullNameAr;
    data.fullName = fullName || fullNameAr;
  }
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (role) data.role = role;
  if (password) data.passwordHash = await bcrypt.hash(String(password), 12);
  if (body.isActive === true && !target.isActive) {
    data.isActive = true;
  }

  await prisma.user.update({
    where: { id: target.id },
    data,
  });

  const effectiveRole = role || target.role;

  if (effectiveRole === ROLES.ADMIN) {
    const allBranches = await getBranchesForUser(target.id, ROLES.ADMIN, auth.companyId);
    await replaceUserBranches(
      target.id,
      allBranches.map((b) => b.id)
    );
    await prisma.userScreenPermission.deleteMany({ where: { userId: target.id } });
  } else {
    await replaceUserBranches(target.id, Array.isArray(branchIds) ? branchIds : []);
    await replaceUserScreenPermissions(
      target.id,
      Array.isArray(screenPermissions) ? screenPermissions : []
    );
  }

  const updated = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      username: true,
      fullNameAr: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      userBranches: {
        include: { branch: { select: { id: true, nameAr: true } } },
      },
      screenPermissions: {
        select: { screenKey: true, allowed: true },
      },
    },
  });

  return NextResponse.json({
    user: updated
      ? {
          ...updated,
          roleLabel: ROLE_LABELS[updated.role] || updated.role,
          branches: updated.userBranches.map((ub) => ub.branch.nameAr),
          branchIds: updated.userBranches.map((ub) => ub.branch.id),
        }
      : null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const target = await prisma.user.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
      isHidden: false,
    },
  });

  if (!target) {
    return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as "activate" | "deactivate" | undefined;

  if (action === "activate") {
    if (target.isActive) {
      return NextResponse.json({ message: "الحساب مفعّل بالفعل" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: true },
    });

    return NextResponse.json({ message: "تم تفعيل المستخدم" });
  }

  if (params.id === auth.userId) {
    return NextResponse.json({ message: "لا يمكن تعطيل حسابك الحالي" }, { status: 400 });
  }

  if (!target.isActive) {
    return NextResponse.json({ message: "الحساب معطّل بالفعل" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: target.id } }),
    prisma.user.update({
      where: { id: target.id },
      data: { isActive: false },
    }),
  ]);

  return NextResponse.json({ message: "تم تعطيل المستخدم" });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  if (params.id === auth.userId) {
    return NextResponse.json({ message: "لا يمكن حذف حسابك الحالي" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
      isHidden: false,
    },
  });

  if (!target) {
    return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: target.id } }),
    prisma.retailPriceChange.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    }),
    prisma.purchaseReturn.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    }),
    prisma.stocktake.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    }),
    prisma.saleReturn.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    }),
    prisma.treasuryShift.updateMany({
      where: { userId: target.id },
      data: { userId: null },
    }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);

  return NextResponse.json({ message: "تم حذف المستخدم" });
}
