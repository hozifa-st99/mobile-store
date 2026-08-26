import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

function parseRequire(value: unknown) {
  return value === true;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  try {
    await prisma.$transaction([
      prisma.phonePlatform.update({
        where: { id: params.id, companyId: auth.companyId },
        data: { isActive: false },
      }),
      prisma.phoneBrand.updateMany({
        where: { platformId: params.id, companyId: auth.companyId },
        data: { isActive: false },
      }),
      prisma.phoneModel.updateMany({
        where: { platformId: params.id, companyId: auth.companyId },
        data: { isActive: false },
      }),
    ]);

    return NextResponse.json({ message: "تم الحذف" });
  } catch (e) {
    console.error("phone-platform delete:", e);
    return NextResponse.json({ message: "تعذر حذف النوع" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { nameAr, requiresBrand, logoUrl, requireColors, requireStorage, requireRam } =
      await request.json();

    const platform = await prisma.phonePlatform.update({
      where: { id: params.id, companyId: auth.companyId },
      data: {
        ...(nameAr !== undefined && { nameAr: String(nameAr).trim() }),
        ...(requiresBrand !== undefined && { requiresBrand: !!requiresBrand }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(requireColors !== undefined && { requireColors: parseRequire(requireColors) }),
        ...(requireStorage !== undefined && { requireStorage: parseRequire(requireStorage) }),
        ...(requireRam !== undefined && { requireRam: parseRequire(requireRam) }),
      },
    });

    return NextResponse.json({ platform });
  } catch (e) {
    console.error("phone-platform update:", e);
    return NextResponse.json({ message: "خطأ في حفظ النوع" }, { status: 500 });
  }
}
