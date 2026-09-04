import { NextRequest, NextResponse } from "next/server";

import {
  getCompanyScopedAuthFromRequest,
  forbiddenResponse,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { normalizeCompanyBranding } from "@/lib/company-branding";
import { isFullAccessRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId },
      select: { id: true, nameAr: true, logoUrl: true },
    });
    if (!company) {
      return NextResponse.json({ message: "الشركة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ company: normalizeCompanyBranding(company) });
  } catch (error) {
    console.error("company settings GET:", error);
    return NextResponse.json({ message: "خطأ في قراءة بيانات الشركة" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (!isFullAccessRole(auth.role)) {
    return forbiddenResponse("هذه الصلاحية للأدمن فقط");
  }

  try {
    const body = await request.json();
    const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
    if (!nameAr) {
      return NextResponse.json({ message: "اسم الشركة مطلوب" }, { status: 400 });
    }

    const logoUrl =
      body.logoUrl === null || body.logoUrl === undefined
        ? null
        : typeof body.logoUrl === "string"
          ? body.logoUrl.trim() || null
          : null;

    const updated = await prisma.company.update({
      where: { id: auth.companyId },
      data: {
        nameAr,
        name: nameAr,
        logoUrl,
      },
      select: { nameAr: true, logoUrl: true },
    });

    return NextResponse.json({ company: normalizeCompanyBranding(updated) });
  } catch (error) {
    console.error("company settings PUT:", error);
    return NextResponse.json({ message: "خطأ في حفظ بيانات الشركة" }, { status: 500 });
  }
}
