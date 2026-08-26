import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { attachPartyBranches, getSupplierBranchesMap } from "@/lib/party-branches";
import {
  SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
  SUPPLIER_KIND_WHOLESALE,
} from "@/lib/supplier-kind";
import {
  findWholesaleSupplierPhoneConflict,
  normalizePartyPhone,
  supplierPhoneConflictMessage,
} from "@/lib/party-phone-uniqueness";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const kind = searchParams.get("kind")?.trim();

  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
      ...(kind === SUPPLIER_KIND_WHOLESALE && { supplierKind: SUPPLIER_KIND_WHOLESALE }),
      ...(kind === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER && {
        supplierKind: SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
      }),
      ...(search && {
        OR: [
          { nameAr: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    },
    orderBy: { nameAr: "asc" },
  });

  const branchesMap = await getSupplierBranchesMap(
    auth.companyId,
    suppliers.map((supplier) => supplier.id)
  );

  return NextResponse.json({ suppliers: attachPartyBranches(suppliers, branchesMap) });
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { nameAr, phone, email, address } = await request.json();
  if (!nameAr?.trim()) {
    return NextResponse.json({ message: "اسم المورد مطلوب" }, { status: 400 });
  }
  if (!phone?.trim()) {
    return NextResponse.json({ message: "رقم الهاتف مطلوب" }, { status: 400 });
  }

  const phoneNormalized = normalizePartyPhone(phone);
  const phoneConflict = await findWholesaleSupplierPhoneConflict(
    prisma,
    auth.companyId,
    phoneNormalized
  );
  if (phoneConflict) {
    return NextResponse.json(
      { message: supplierPhoneConflictMessage(phoneConflict.nameAr) },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      companyId: auth.companyId,
      nameAr: nameAr.trim(),
      phone: phoneNormalized,
      email: email?.trim() || null,
      address: address?.trim() || null,
      supplierKind: SUPPLIER_KIND_WHOLESALE,
    },
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
