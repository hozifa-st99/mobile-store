import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { allocateBranchEmployeeCode } from "@/lib/branch-employee-code";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const employees = await prisma.branchEmployee.findMany({
    where: {
      branchId: auth.branchId,
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { nameAr: { contains: search } },
              { phone: { contains: search } },
              { employeeCode: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ employeeCode: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { nameAr, phone, address } = await request.json();
    if (!nameAr?.trim()) {
      return NextResponse.json({ message: "اسم الموظف مطلوب" }, { status: 400 });
    }

    const employee = await prisma.$transaction(async (tx) => {
      const employeeCode = await allocateBranchEmployeeCode(tx, auth.branchId);
      return tx.branchEmployee.create({
        data: {
          branchId: auth.branchId,
          employeeCode,
          nameAr: nameAr.trim(),
          phone: phone?.trim() || null,
          address: address?.trim() || null,
        },
      });
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error("[branch-employees POST]", error);
    if (
      error instanceof Error &&
      error.message.includes("branchEmployee")
    ) {
      return NextResponse.json(
        { message: "يجب إعادة تشغيل السيرفر بعد تحديث قاعدة البيانات" },
        { status: 503 }
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "رقم الموظف مكرر — حاول مرة أخرى" }, { status: 400 });
    }
    return NextResponse.json({ message: "تعذّر حفظ الموظف — حاول مرة أخرى" }, { status: 500 });
  }
}
