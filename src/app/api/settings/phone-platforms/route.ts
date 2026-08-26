import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { ensureDefaultPhonePlatforms } from "@/lib/phone-platform-defaults";
import { phoneModelSpecsInclude, serializePlatforms } from "@/lib/phone-model-specs";

export async function GET(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  await ensureDefaultPhonePlatforms(auth.companyId);

  const platforms = await prisma.phonePlatform.findMany({
    where: { companyId: auth.companyId, isActive: true },
    include: {
      brands: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          models: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: phoneModelSpecsInclude,
          },
        },
      },
      models: {
        where: { brandId: null, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: phoneModelSpecsInclude,
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ platforms: serializePlatforms(platforms) });
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { nameAr, requiresBrand, logoUrl } = await request.json();
  if (!nameAr?.trim()) {
    return NextResponse.json({ message: "الاسم مطلوب" }, { status: 400 });
  }

  try {
    const platform = await prisma.phonePlatform.create({
      data: {
        companyId: auth.companyId,
        nameAr: nameAr.trim(),
        requiresBrand: !!requiresBrand,
        logoUrl: logoUrl || null,
      },
    });

    return NextResponse.json({ platform }, { status: 201 });
  } catch (e) {
    console.error("phone-platform create:", e);
    return NextResponse.json({ message: "خطأ في الحفظ — أعد تشغيل السيرفر" }, { status: 500 });
  }
}
