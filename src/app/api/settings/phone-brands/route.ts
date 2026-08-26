import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

function parseRequire(value: unknown) {
  return value === true;
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { platformId, nameAr, logoUrl, requireColors, requireStorage, requireRam } =
    await request.json();
  if (!platformId || !nameAr?.trim()) {
    return NextResponse.json({ message: "الاسم ونوع الجهاز مطلوبان" }, { status: 400 });
  }

  try {
    const brand = await prisma.phoneBrand.create({
      data: {
        companyId: auth.companyId,
        platformId,
        nameAr: nameAr.trim(),
        logoUrl: logoUrl || null,
        requireColors: parseRequire(requireColors),
        requireStorage: parseRequire(requireStorage),
        requireRam: parseRequire(requireRam),
      },
    });

    return NextResponse.json({ brand }, { status: 201 });
  } catch (e) {
    console.error("phone-brand create:", e);
    return NextResponse.json(
      { message: "خطأ في الحفظ — شغّل RESTART.bat ثم حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
