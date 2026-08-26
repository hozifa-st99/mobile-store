import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/auth";
import { APP_SCREENS, ROLES, SCREEN_KEYS } from "@/lib/permissions";
import { requireUserManager } from "@/lib/api-auth";
import {
  buildDefaultScreenPermissions,
  getBranchesForUser,
  replaceUserBranches,
  replaceUserScreenPermissions,
} from "@/lib/user-permissions-service";

function serializeUser(
  u: {
    id: string;
    username: string;
    fullNameAr: string;
    email: string | null;
    phone: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    userBranches: Array<{ branch: { id: string; nameAr: string } }>;
    screenPermissions: Array<{ screenKey: string; allowed: boolean }>;
  }
) {
  return {
    id: u.id,
    username: u.username,
    fullNameAr: u.fullNameAr,
    email: u.email,
    phone: u.phone,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] || u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    branches: u.userBranches.map((ub) => ub.branch.nameAr),
    branchIds: u.userBranches.map((ub) => ub.branch.id),
    screenPermissions: u.screenPermissions,
  };
}

export async function GET(request: NextRequest) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const users = await prisma.user.findMany({
    where: {
      companyId: auth.companyId,
      isHidden: false,
    },
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
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    users: users.map(serializeUser),
    screens: APP_SCREENS,
  });
}

export async function POST(request: NextRequest) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const body = await request.json();
  const {
    username,
    password,
    fullNameAr,
    fullName,
    email,
    phone,
    role,
    branchIds = [],
    screenPermissions = [],
  } = body;

  if (!username || !password || !fullNameAr) {
    return NextResponse.json(
      { message: "اسم المستخدم وكلمة المرور والاسم مطلوبان" },
      { status: 400 }
    );
  }

  if (role !== ROLES.ADMIN && role !== ROLES.EMPLOYEE) {
    return NextResponse.json({ message: "الدور غير مسموح" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ message: "اسم المستخدم مستخدم بالفعل" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);

  const user = await prisma.user.create({
    data: {
      companyId: auth.companyId,
      username: String(username).trim(),
      passwordHash,
      fullName: fullName || fullNameAr,
      fullNameAr,
      email: email || null,
      phone: phone || null,
      role,
      isHidden: false,
    },
  });

  if (role === ROLES.ADMIN) {
    const allBranches = await getBranchesForUser(user.id, ROLES.ADMIN, auth.companyId);
    await replaceUserBranches(
      user.id,
      allBranches.map((b) => b.id)
    );
  } else {
    await replaceUserBranches(user.id, Array.isArray(branchIds) ? branchIds : []);
    await replaceUserScreenPermissions(
      user.id,
      Array.isArray(screenPermissions) ? screenPermissions : buildDefaultScreenPermissions(false)
    );
  }

  const created = await prisma.user.findUnique({
    where: { id: user.id },
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

  return NextResponse.json({ user: created ? serializeUser(created) : null }, { status: 201 });
}
