import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, verifyRefreshToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refreshToken")?.value;
  if (!refreshToken) {
    return unauthorizedResponse("انتهت الجلسة — سجّل الدخول مجدداً");
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return unauthorizedResponse("انتهت الجلسة — سجّل الدخول مجدداً");
  }

  const stored = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      userId: payload.userId,
      expiresAt: { gt: new Date() },
    },
  });
  if (!stored) {
    return unauthorizedResponse("انتهت الجلسة — سجّل الدخول مجدداً");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });
  if (!user?.isActive) return unauthorizedResponse();

  const branchId = request.cookies.get("branchId")?.value;
  let branchName: string | undefined;

  if (branchId) {
    const userBranch = await prisma.userBranch.findFirst({
      where: {
        userId: user.id,
        branchId,
        branch: { isActive: true },
      },
      include: { branch: true },
    });
    if (userBranch) branchName = userBranch.branch.nameAr;
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    fullNameAr: user.fullNameAr,
    role: user.role,
    companyId: user.companyId,
    ...(branchId ? { branchId, branchName } : {}),
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  return response;
}
