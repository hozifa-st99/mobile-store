import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { isSiteCurrentlyActive } from "@/lib/permissions";
import {
  assertSiteAccess,
  getAllowedScreensForUser,
  getBranchesForUser,
  mapBranchesResponse,
} from "@/lib/user-permissions-service";

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "اسم المستخدم وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { message: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { message: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const siteBlockMessage = await assertSiteAccess(user.role, user.companyId);
    if (siteBlockMessage) {
      return NextResponse.json({ message: siteBlockMessage }, { status: 403 });
    }

    const allowedScreens = await getAllowedScreensForUser(user.id, user.role);
    const branchRows = await getBranchesForUser(user.id, user.role, user.companyId);
    const defaultLink = await prisma.userBranch.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { branchId: true },
    });

    const branches = mapBranchesResponse(branchRows, defaultLink?.branchId);

    const accessToken = await signAccessToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      fullNameAr: user.fullNameAr,
      role: user.role,
      companyId: user.companyId,
    });

    const refreshToken = await signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullNameAr,
        role: user.role,
        companyName: user.company.nameAr,
      },
      branches,
      allowedScreens,
      siteActive: isSiteCurrentlyActive(user.company.siteActivatedUntil),
      accessToken,
    });

    const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
