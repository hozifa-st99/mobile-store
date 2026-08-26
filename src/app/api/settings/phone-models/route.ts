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

export async function POST(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { platformId, brandId, nameAr, logoUrl, colors, storageOptions, ramOptions } =
    await request.json();
  if (!platformId || !nameAr?.trim()) {
    return NextResponse.json({ message: "الاسم ونوع الجهاز مطلوبان" }, { status: 400 });
  }

  try {
    const requirements = await getModelSpecRequirements(prisma, auth.companyId, {
      platformId,
      brandId: brandId || null,
    });
    if (!requirements) {
      return NextResponse.json({ message: "الشركة أو النوع غير موجود" }, { status: 400 });
    }

    const specs = {
      colors: normalizeOptionList(Array.isArray(colors) ? colors : []),
      storageOptions: normalizeOptionList(Array.isArray(storageOptions) ? storageOptions : []),
      ramOptions: normalizeOptionList(Array.isArray(ramOptions) ? ramOptions : []),
    };

    const validationError = validateModelSpecs(specs, requirements);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const model = await prisma.$transaction(async (tx) => {
      const created = await tx.phoneModel.create({
        data: {
          companyId: auth.companyId,
          platformId,
          brandId: brandId || null,
          nameAr: nameAr.trim(),
          logoUrl: logoUrl || null,
        },
      });

      await syncModelSpecs(tx, created.id, specs);

      return tx.phoneModel.findUniqueOrThrow({
        where: { id: created.id },
        include: phoneModelSpecsInclude,
      });
    });

    return NextResponse.json({ model: serializePhoneModel(model) }, { status: 201 });
  } catch (e) {
    console.error("phone-model create:", e);
    return NextResponse.json({ message: "خطأ في الحفظ — أعد تشغيل السيرفر" }, { status: 500 });
  }
}
