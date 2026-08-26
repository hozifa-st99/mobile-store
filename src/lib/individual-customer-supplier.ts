import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SUPPLIER_KIND_INDIVIDUAL_CUSTOMER } from "@/lib/supplier-kind";

type DbClient = Prisma.TransactionClient | typeof prisma;

function placeholderPhone(phone: string | null | undefined) {
  const trimmed = phone?.trim();
  return trimmed || "—";
}

export async function getOrCreateIndividualCustomerSupplier(
  db: DbClient,
  companyId: string,
  customerId: string
) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId, isActive: true },
  });
  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const existing = await db.supplier.findFirst({
    where: {
      companyId,
      customerId: customer.id,
      supplierKind: SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
    },
  });

  const syncData = {
    nameAr: customer.nameAr,
    phone: placeholderPhone(customer.phone),
  };

  if (existing) {
    if (existing.nameAr !== syncData.nameAr || existing.phone !== syncData.phone) {
      return db.supplier.update({
        where: { id: existing.id },
        data: syncData,
      });
    }
    return existing;
  }

  return db.supplier.create({
    data: {
      companyId,
      ...syncData,
      supplierKind: SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
      customerId: customer.id,
    },
  });
}

export async function syncIndividualCustomerSupplierFromCustomer(
  db: DbClient,
  companyId: string,
  customerId: string,
  data: { nameAr: string; phone: string | null | undefined }
) {
  await db.supplier.updateMany({
    where: {
      companyId,
      customerId,
      supplierKind: SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
    },
    data: {
      nameAr: data.nameAr.trim(),
      phone: placeholderPhone(data.phone),
    },
  });
}
