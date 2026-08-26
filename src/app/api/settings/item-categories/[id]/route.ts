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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { nameAr, logoUrl } = await request.json();

    const category = await prisma.itemCategory.update({
      where: { id: params.id, companyId: auth.companyId },
      data: {
        ...(nameAr !== undefined && { nameAr: String(nameAr).trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
      },
    });

    return NextResponse.json({ category });
  } catch (e) {
    console.error("item-category update:", e);
    return NextResponse.json({ message: prismaErrorMessage(e, "تعذر تعديل الصنف") }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  try {
    await prisma.itemCategory.update({
      where: { id: params.id, companyId: auth.companyId },
      data: { isActive: false },
    });

    await prisma.itemBrand.updateMany({
      where: { categoryId: params.id, companyId: auth.companyId },
      data: { isActive: false },
    });

    const brandIds = await prisma.itemBrand.findMany({
      where: { categoryId: params.id, companyId: auth.companyId },
      select: { id: true },
    });
    if (brandIds.length > 0) {
      await prisma.itemName.updateMany({
        where: { brandId: { in: brandIds.map((b) => b.id) }, companyId: auth.companyId },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ message: "تم الحذف" });
  } catch (e) {
    console.error("item-category delete:", e);
    return NextResponse.json({ message: prismaErrorMessage(e, "تعذر حذف الصنف") }, { status: 500 });
  }
}
