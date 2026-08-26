import type { Prisma } from "@prisma/client";



type Db = Prisma.TransactionClient;



function normalizePhone(value: string): string {

  return value.replace(/\s+/g, "").trim();

}



async function findCustomerByPhone(tx: Db, companyId: string, phone: string) {

  const normalized = normalizePhone(phone);

  if (!normalized) return null;



  const candidates = await tx.customer.findMany({

    where: { companyId, isActive: true, phone: { not: null } },

    select: { id: true, nameAr: true, phone: true },

  });



  return candidates.find((c) => normalizePhone(c.phone || "") === normalized) ?? null;

}



async function syncCustomerName(

  tx: Db,

  customerId: string,

  currentName: string,

  nextName?: string | null

) {

  const nameAr = nextName?.trim();

  if (!nameAr || nameAr === currentName) return;

  await tx.customer.update({

    where: { id: customerId },

    data: { nameAr },

  });

}



export async function resolveCustomerIdForSale(

  tx: Db,

  companyId: string,

  input: {

    customerId?: string | null;

    customerName?: string | null;

    customerPhone?: string | null;

  }

): Promise<string | null> {

  const explicitId = input.customerId?.trim();

  const nameAr = input.customerName?.trim();

  const phone = input.customerPhone ? normalizePhone(input.customerPhone) : null;



  if (explicitId) {

    const existing = await tx.customer.findFirst({

      where: { id: explicitId, companyId, isActive: true },

      select: { id: true, nameAr: true },

    });

    if (!existing) throw new Error("CUSTOMER_NOT_FOUND");

    await syncCustomerName(tx, existing.id, existing.nameAr, nameAr);

    return existing.id;

  }



  if (!nameAr && !phone) return null;

  if (!nameAr) {

    const byPhone = phone ? await findCustomerByPhone(tx, companyId, phone) : null;

    return byPhone?.id ?? null;

  }



  if (phone) {

    const byPhone = await findCustomerByPhone(tx, companyId, phone);

    if (byPhone) {

      await syncCustomerName(tx, byPhone.id, byPhone.nameAr, nameAr);

      return byPhone.id;

    }

  }



  const created = await tx.customer.create({

    data: {

      companyId,

      nameAr,

      phone,

    },

    select: { id: true },

  });



  return created.id;

}

