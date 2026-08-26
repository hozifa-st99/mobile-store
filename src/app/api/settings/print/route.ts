import { NextRequest, NextResponse } from "next/server";

import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PRINT_SETTINGS, normalizePrintSettings } from "@/lib/print-settings";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const row = await prisma.appSetting.findUnique({
      where: {
        companyId_key: { companyId: auth.companyId, key: "print" },
      },
    });

    const settings = row
      ? normalizePrintSettings(JSON.parse(row.value))
      : DEFAULT_PRINT_SETTINGS;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("print settings GET:", error);
    return NextResponse.json(
      { message: "خطأ في قراءة إعدادات الطباعة" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const settings = normalizePrintSettings(body);

    await prisma.appSetting.upsert({
      where: {
        companyId_key: { companyId: auth.companyId, key: "print" },
      },
      create: {
        companyId: auth.companyId,
        key: "print",
        value: JSON.stringify(settings),
      },
      update: { value: JSON.stringify(settings) },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("print settings PUT:", error);
    return NextResponse.json(
      { message: "خطأ في حفظ إعدادات الطباعة — شغّل RESTART.bat ثم حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
