import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeActivationUntil,
  formatActivationExpiry,
  isLifetimeActivation,
  isSiteCurrentlyActive,
  type ActivationPeriodKey,
} from "@/lib/permissions";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { auth, error } = await requireSuperAdmin(request);
  if (error || !auth) return error;

  const company = await prisma.company.findUnique({
    where: { id: auth.companyId },
    select: { siteActivatedUntil: true },
  });

  return NextResponse.json({
    siteActive: isSiteCurrentlyActive(company?.siteActivatedUntil),
    siteActivatedUntil: company?.siteActivatedUntil?.toISOString() ?? null,
    isLifetime: isLifetimeActivation(company?.siteActivatedUntil),
    activationLabel: company?.siteActivatedUntil
      ? formatActivationExpiry(company.siteActivatedUntil)
      : null,
  });
}

export async function POST(request: NextRequest) {
  const { auth, error } = await requireSuperAdmin(request);
  if (error || !auth) return error;

  const body = await request.json();
  const action = body.action as "activate" | "deactivate";

  if (action === "deactivate") {
    const company = await prisma.company.update({
      where: { id: auth.companyId },
      data: { siteActivatedUntil: null },
      select: { siteActivatedUntil: true },
    });

    return NextResponse.json({
      message: "تم إلغاء تفعيل الموقع",
      siteActive: false,
      siteActivatedUntil: company.siteActivatedUntil,
    });
  }

  if (action !== "activate") {
    return NextResponse.json({ message: "إجراء غير صالح" }, { status: 400 });
  }

  const period = body.period as ActivationPeriodKey | "custom" | "lifetime";
  const customDays = typeof body.customDays === "number" ? body.customDays : undefined;
  const activatedUntil = computeActivationUntil(period, customDays);

  const company = await prisma.company.update({
    where: { id: auth.companyId },
    data: { siteActivatedUntil: activatedUntil },
    select: { siteActivatedUntil: true },
  });

  const message =
    period === "lifetime" ? "تم تفعيل الموقع مدى الحياة" : "تم تفعيل الموقع بنجاح";

  return NextResponse.json({
    message,
    siteActive: isSiteCurrentlyActive(company.siteActivatedUntil),
    siteActivatedUntil: company.siteActivatedUntil?.toISOString() ?? null,
    isLifetime: isLifetimeActivation(company.siteActivatedUntil),
    activationLabel: company.siteActivatedUntil
      ? formatActivationExpiry(company.siteActivatedUntil)
      : null,
  });
}
