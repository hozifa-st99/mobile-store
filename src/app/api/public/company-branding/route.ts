import { NextResponse } from "next/server";

import { loadSingleCompanyBranding } from "@/lib/company-branding";
import { prisma } from "@/lib/prisma";

/** عرض اسم ولوجo الشركة — بدون تسجيل دخول (شركة واحدة على السيرفر) */
export async function GET() {
  try {
    const branding = await loadSingleCompanyBranding(prisma);
    return NextResponse.json({ branding });
  } catch (error) {
    console.error("company-branding public GET:", error);
    return NextResponse.json({ message: "تعذر تحميل بيانات الشركة" }, { status: 500 });
  }
}
