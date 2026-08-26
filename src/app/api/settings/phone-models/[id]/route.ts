import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { normalizeOptionList } from "@/lib/phone-model-options";
import { getModelSpecRequirements, validateModelSpecs } from "@/lib/phone-model-requirements";
import {
  phoneModelSpecsInclude,
  serializePhoneModel,
  syncModelSpecs,
} from "@/lib/phone-model-specs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  try {
    await prisma.phoneModel.update({
      where: { id: params.id, companyId: auth.companyId },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "تم الحذف" });
  } catch (e) {
    console.error("phone-model delete:", e);
    return NextResponse.json({ message: "تعذر حذف الموديل" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const existing = await prisma.phoneModel.findFirst({
      where: { id: params.id, companyId: auth.companyId, isActive: true },
      include: phoneModelSpecsInclude,
    });
    if (!existing) {
      return NextResponse.json({ message: "الموديل غير موجود" }, { status: 404 });
    }

    const { nameAr, logoUrl, colors, storageOptions, ramOptions } = await request.json();

    const requirements = await getModelSpecRequirements(prisma, auth.companyId, {
      platformId: existing.platformId,
      brandId: existing.brandId,
    });
    if (!requirements) {
      return NextResponse.json({ message: "الشركة أو النوع غير موجود" }, { status: 400 });
    }

    const currentLists = {
      colors: normalizeOptionList(
        colors !== undefined
          ? Array.isArray(colors)
            ? colors
            : []
          : existing.colors.map((c) => c.nameAr)
      ),
      storageOptions: normalizeOptionList(
        storageOptions !== undefined
          ? Array.isArray(storageOptions)
            ? storageOptions
            : []
          : existing.storages.map((s) => s.nameAr)
      ),
      ramOptions: normalizeOptionList(
        ramOptions !== undefined
          ? Array.isArray(ramOptions)
            ? ramOptions
            : []
          : existing.rams.map((r) => r.nameAr)
      ),
    };

    const validationError = validateModelSpecs(currentLists, requirements);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const model = await prisma.$transaction(async (tx) => {
      await tx.phoneModel.update({
        where: { id: params.id, companyId: auth.companyId },
        data: {
          ...(nameAr !== undefined && { nameAr: String(nameAr).trim() }),
          ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        },
      });

      if (colors !== undefined || storageOptions !== undefined || ramOptions !== undefined) {
        await syncModelSpecs(tx, params.id, currentLists);
      }

      return tx.phoneModel.findUniqueOrThrow({
        where: { id: params.id },
        include: phoneModelSpecsInclude,
      });
    });

    return NextResponse.json({ model: serializePhoneModel(model) });
  } catch (e) {
    console.error("phone-model update:", e);
    return NextResponse.json(
      { message: "خطأ في حفظ الموديل — أعد تشغيل السيرفر (RESTART.bat)" },
      { status: 500 }
    );
  }
}
