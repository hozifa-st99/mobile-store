import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, verifyAccessToken } from "@/lib/auth";
import { isFullAccessRole } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ message: "انتهت الجلسة" }, { status: 401 });
    }

    const { branchId } = await request.json();
    if (!branchId) {
      return NextResponse.json({ message: "يجب اختيار فرع" }, { status: 400 });
    }

    let branch = null as null | {
      id: string;
      nameAr: string;
      address: string | null;
    };

    if (isFullAccessRole(payload.role)) {
      branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          companyId: payload.companyId,
          isActive: true,
        },
        select: { id: true, nameAr: true, address: true },
      });
    } else {
      const userBranch = await prisma.userBranch.findFirst({
        where: {
          userId: payload.userId,
          branchId,
          branch: { isActive: true, companyId: payload.companyId },
        },
        include: { branch: true },
      });
      branch = userBranch
        ? {
            id: userBranch.branch.id,
            nameAr: userBranch.branch.nameAr,
            address: userBranch.branch.address,
          }
        : null;
    }

    if (!branch) {
      return NextResponse.json(
        { message: "ليس لديك صلاحية للدخول إلى هذا الفرع" },
        { status: 403 }
      );
    }

    const newToken = await signAccessToken({
      userId: payload.userId,
      username: payload.username,
      fullName: payload.fullName,
      fullNameAr: payload.fullNameAr,
      role: payload.role,
      companyId: payload.companyId,
      branchId: branch.id,
      branchName: branch.nameAr,
    });

    const response = NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.nameAr,
        address: branch.address,
      },
      accessToken: newToken,
    });

    response.cookies.set("accessToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    response.cookies.set("branchId", branchId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Select branch error:", error);
    return NextResponse.json({ message: "حدث خطأ" }, { status: 500 });
  }
}
