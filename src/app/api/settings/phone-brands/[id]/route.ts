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
      prisma.phoneBrand.update({
        where: { id: params.id, companyId: auth.companyId },
        data: { isActive: false },
      }),
      prisma.phoneModel.updateMany({
        where: { brandId: params.id, companyId: auth.companyId },
        data: { isActive: false },
      }),
    ]);

    return NextResponse.json({ message: "تم الحذف" });
  } catch (e) {
    console.error("phone-brand delete:", e);
    return NextResponse.json({ message: "تعذر حذف الشركة" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { nameAr, logoUrl, requireColors, requireStorage, requireRam } = await request.json();

    const brand = await prisma.phoneBrand.update({
      where: { id: params.id, companyId: auth.companyId },
      data: {
        ...(nameAr !== undefined && { nameAr: String(nameAr).trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(requireColors !== undefined && { requireColors: parseRequire(requireColors) }),
        ...(requireStorage !== undefined && { requireStorage: parseRequire(requireStorage) }),
        ...(requireRam !== undefined && { requireRam: parseRequire(requireRam) }),
      },
    });

    return NextResponse.json({ brand });
  } catch (e) {
    console.error("phone-brand update:", e);
    return NextResponse.json(
      { message: "خطأ في حفظ الشركة — شغّل RESTART.bat ثم حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
