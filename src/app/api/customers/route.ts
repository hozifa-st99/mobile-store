import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { attachPartyBranches, getCustomerBranchesMap } from "@/lib/party-branches";
import {
  customerPhoneConflictMessage,
  findCustomerPhoneConflict,
  normalizePartyPhone,
} from "@/lib/party-phone-uniqueness";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const customers = await prisma.customer.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
      ...(search && {
        OR: [
          { nameAr: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
  });

  const branchesMap = await getCustomerBranchesMap(
    auth.companyId,
    customers.map((customer) => customer.id)
  );

  return NextResponse.json({ customers: attachPartyBranches(customers, branchesMap) });
}

export async function POST(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { nameAr, phone, email, address, notes } = await request.json();
  if (!nameAr?.trim()) {
    return NextResponse.json({ message: "اسم العميل مطلوب" }, { status: 400 });
  }
  if (!phone?.trim()) {
    return NextResponse.json({ message: "رقم الهاتف مطلوب" }, { status: 400 });
  }

  const phoneNormalized = normalizePartyPhone(phone);
  if (!phoneNormalized) {
    return NextResponse.json({ message: "رقم الهاتف غير صالح" }, { status: 400 });
  }
  const phoneConflict = await findCustomerPhoneConflict(prisma, auth.companyId, phoneNormalized);
  if (phoneConflict) {
    return NextResponse.json(
      { message: customerPhoneConflictMessage(phoneConflict.nameAr) },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.create({
    data: {
      companyId: auth.companyId,
      nameAr: nameAr.trim(),
      phone: phoneNormalized,
      email: email || null,
      address: address || null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
