import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { syncIndividualCustomerSupplierFromCustomer } from "@/lib/individual-customer-supplier";
import {
  customerPhoneConflictMessage,
  findCustomerPhoneConflict,
  normalizePartyPhone,
} from "@/lib/party-phone-uniqueness";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const body = await request.json();
  if (!body.nameAr?.trim()) {
    return NextResponse.json({ message: "اسم العميل مطلوب" }, { status: 400 });
  }
  if (!body.phone?.trim()) {
    return NextResponse.json({ message: "رقم الهاتف مطلوب" }, { status: 400 });
  }

  const nameAr = body.nameAr.trim();
  const phone = normalizePartyPhone(body.phone);
  if (!phone) {
    return NextResponse.json({ message: "رقم الهاتف غير صالح" }, { status: 400 });
  }

  const phoneConflict = await findCustomerPhoneConflict(prisma, auth.companyId, phone, params.id);
  if (phoneConflict) {
    return NextResponse.json(
      { message: customerPhoneConflictMessage(phoneConflict.nameAr) },
      { status: 400 }
    );
  }

  const customer = await prisma.customer.updateMany({
    where: { id: params.id, companyId: auth.companyId },
    data: {
      nameAr,
      phone,
      email: body.email ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
    },
  });

  if (customer.count === 0) {
    return NextResponse.json({ message: "العميل غير موجود" }, { status: 404 });
  }

  await syncIndividualCustomerSupplierFromCustomer(prisma, auth.companyId, params.id, {
    nameAr,
    phone,
  });

  const updated = await prisma.customer.findUnique({ where: { id: params.id } });
  return NextResponse.json({ customer: updated });
}
