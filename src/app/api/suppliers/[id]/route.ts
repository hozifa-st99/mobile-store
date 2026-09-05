import { NextRequest, NextResponse } from "next/server";

import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { SUPPLIER_KIND_WHOLESALE } from "@/lib/supplier-kind";
import {
  findWholesaleSupplierPhoneConflict,
  normalizePartyPhone,
  supplierPhoneConflictMessage,
} from "@/lib/party-phone-uniqueness";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json();

  if (!body.nameAr?.trim()) {
    return NextResponse.json({ message: "اسم المورد مطلوب" }, { status: 400 });
  }
  if (!body.phone?.trim()) {
    return NextResponse.json({ message: "رقم الهاتف مطلوب" }, { status: 400 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, companyId: auth.companyId, isActive: true },
    select: { id: true, supplierKind: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "المورد غير موجود" }, { status: 404 });
  }

  const phoneNormalized = normalizePartyPhone(body.phone);
  if (!phoneNormalized) {
    return NextResponse.json({ message: "رقم الهاتف غير صالح" }, { status: 400 });
  }
  if (existing.supplierKind === SUPPLIER_KIND_WHOLESALE) {
    const phoneConflict = await findWholesaleSupplierPhoneConflict(
      prisma,
      auth.companyId,
      phoneNormalized,
      id
    );
    if (phoneConflict) {
      return NextResponse.json(
        { message: supplierPhoneConflictMessage(phoneConflict.nameAr) },
        { status: 400 }
      );
    }
  }

  const result = await prisma.supplier.updateMany({
    where: { id, companyId: auth.companyId, isActive: true },
    data: {
      nameAr: body.nameAr.trim(),
      phone: phoneNormalized,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ message: "المورد غير موجود" }, { status: 404 });
  }

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  return NextResponse.json({ supplier });
}
