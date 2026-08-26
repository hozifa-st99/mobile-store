import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

function prismaErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    return error.message.includes("itemName")
      ? `${fallback} — أعد تشغيل السيرفر (RESTART.bat)`
      : `${fallback}: ${error.message}`;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { brandId, nameAr, logoUrl } = await request.json();
  if (!brandId || !nameAr?.trim()) {
    return NextResponse.json({ message: "العلامة واسم الصنف مطلوبان" }, { status: 400 });
  }

  try {
    const brand = await prisma.itemBrand.findFirst({
      where: { id: brandId, companyId: auth.companyId, isActive: true },
    });
    if (!brand) {
      return NextResponse.json({ message: "العلامة التجارية غير موجودة" }, { status: 404 });
    }

    const count = await prisma.itemName.count({
      where: { brandId, companyId: auth.companyId, isActive: true },
    });

    const name = await prisma.itemName.create({
      data: {
        companyId: auth.companyId,
        brandId,
        nameAr: nameAr.trim(),
        logoUrl: logoUrl || null,
        sortOrder: count,
      },
    });

    return NextResponse.json({ name }, { status: 201 });
  } catch (e) {
    console.error("item-name create:", e);
    return NextResponse.json(
      { message: prismaErrorMessage(e, "خطأ في حفظ اسم الصنف") },
      { status: 500 }
    );
  }
}
