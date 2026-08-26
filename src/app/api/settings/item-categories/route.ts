import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

function prismaErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    if (error.message.includes("itemCategory") || error.message.includes("itemBrand")) {
      return `${fallback} — أعد تشغيل السيرفر (RESTART.bat)`;
    }
    return `${fallback}: ${error.message}`;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const categories = await prisma.itemCategory.findMany({
      where: { companyId: auth.companyId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        brands: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            names: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (e) {
    console.error("item-category list:", e);
    return NextResponse.json(
      { message: prismaErrorMessage(e, "تعذر تحميل الأصناف") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { nameAr, logoUrl } = await request.json();
  if (!nameAr?.trim()) {
    return NextResponse.json({ message: "اسم الصنف مطلوب" }, { status: 400 });
  }

  try {
    const count = await prisma.itemCategory.count({
      where: { companyId: auth.companyId, isActive: true },
    });

    const category = await prisma.itemCategory.create({
      data: {
        companyId: auth.companyId,
        nameAr: nameAr.trim(),
        logoUrl: logoUrl || null,
        sortOrder: count,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    console.error("item-category create:", e);
    return NextResponse.json({ message: prismaErrorMessage(e, "خطأ في حفظ الصنف") }, { status: 500 });
  }
}
