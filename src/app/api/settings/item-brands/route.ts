import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

function prismaErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    return error.message.includes("itemCategory") || error.message.includes("itemBrand")
      ? `${fallback} — أعد تشغيل السيرفر (RESTART.bat)`
      : `${fallback}: ${error.message}`;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { categoryId, nameAr, logoUrl } = await request.json();
  if (!categoryId || !nameAr?.trim()) {
    return NextResponse.json({ message: "الصنف واسم العلامة مطلوبان" }, { status: 400 });
  }

  try {
    const category = await prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId: auth.companyId, isActive: true },
    });
    if (!category) {
      return NextResponse.json({ message: "الصنف غير موجود" }, { status: 404 });
    }

    const count = await prisma.itemBrand.count({
      where: { categoryId, companyId: auth.companyId, isActive: true },
    });

    const brand = await prisma.itemBrand.create({
      data: {
        companyId: auth.companyId,
        categoryId,
        nameAr: nameAr.trim(),
        logoUrl: logoUrl || null,
        sortOrder: count,
      },
    });

    return NextResponse.json({ brand }, { status: 201 });
  } catch (e) {
    console.error("item-brand create:", e);
    return NextResponse.json({ message: prismaErrorMessage(e, "خطأ في حفظ العلامة التجارية") }, { status: 500 });
  }
}
