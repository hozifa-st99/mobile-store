import { NextRequest, NextResponse } from "next/server";

import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SALES_SETTINGS, normalizeSalesSettings } from "@/lib/sales-settings";

const SETTING_KEY = "sales";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const row = await prisma.appSetting.findUnique({
      where: {
        companyId_key: { companyId: auth.companyId, key: SETTING_KEY },
      },
    });

    const settings = row
      ? normalizeSalesSettings(JSON.parse(row.value))
      : DEFAULT_SALES_SETTINGS;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("sales settings GET:", error);
    return NextResponse.json({ message: "خطأ في قراءة إعدادات المبيعات" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const settings = normalizeSalesSettings(body);

    await prisma.appSetting.upsert({
      where: {
        companyId_key: { companyId: auth.companyId, key: SETTING_KEY },
      },
      create: {
        companyId: auth.companyId,
        key: SETTING_KEY,
        value: JSON.stringify(settings),
      },
      update: { value: JSON.stringify(settings) },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("sales settings PUT:", error);
    return NextResponse.json({ message: "خطأ في حفظ إعدادات المبيعات" }, { status: 500 });
  }
}