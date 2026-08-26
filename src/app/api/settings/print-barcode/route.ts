import { NextRequest, NextResponse } from "next/server";

import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import {
  DEFAULT_BARCODE_PRINT_SETTINGS,
  normalizeBarcodePrintSettings,
} from "@/lib/barcode-print-settings";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const row = await prisma.appSetting.findUnique({
      where: {
        companyId_key: { companyId: auth.companyId, key: "print_barcode" },
      },
    });

    const settings = row
      ? normalizeBarcodePrintSettings(JSON.parse(row.value))
      : DEFAULT_BARCODE_PRINT_SETTINGS;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("print-barcode settings GET:", error);
    return NextResponse.json({ message: "خطأ في قراءة إعدادات باركود الطباعة" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const settings = normalizeBarcodePrintSettings(body);

    await prisma.appSetting.upsert({
      where: {
        companyId_key: { companyId: auth.companyId, key: "print_barcode" },
      },
      create: {
        companyId: auth.companyId,
        key: "print_barcode",
        value: JSON.stringify(settings),
      },
      update: { value: JSON.stringify(settings) },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("print-barcode settings PUT:", error);
    return NextResponse.json(
      { message: "خطأ في حفظ إعدادات باركود الطباعة — شغّل RESTART.bat ثم حاول مرة أخرى" },
      { status: 500 }
    );
  }
}
