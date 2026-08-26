import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

const DEFAULT_SETTINGS = {
  lowStockAlert: true,
  lowStockThreshold: 5,
  installmentReminder: true,
  maintenanceReady: true,
  dailySalesReport: false,
};

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const row = await prisma.appSetting.findUnique({
    where: {
      companyId_key: { companyId: auth.companyId, key: "notifications" },
    },
  });

  const settings = row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } : DEFAULT_SETTINGS;
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const body = await request.json();
  const settings = { ...DEFAULT_SETTINGS, ...body };

  await prisma.appSetting.upsert({
    where: {
      companyId_key: { companyId: auth.companyId, key: "notifications" },
    },
    create: {
      companyId: auth.companyId,
      key: "notifications",
      value: JSON.stringify(settings),
    },
    update: { value: JSON.stringify(settings) },
  });

  return NextResponse.json({ settings });
}
