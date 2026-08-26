import type { Prisma } from "@prisma/client";

import { SUPPLIER_KIND_WHOLESALE } from "@/lib/supplier-kind";

type DbClient = Prisma.TransactionClient | { customer: Prisma.CustomerDelegate; supplier: Prisma.SupplierDelegate };

export function normalizePartyPhone(phone: string) {
  return phone.trim();
}

export async function findCustomerPhoneConflict(
  db: DbClient,
  companyId: string,
  phone: string,
  excludeCustomerId?: string
) {
  const normalized = normalizePartyPhone(phone);
  return db.customer.findFirst({
    where: {
      companyId,
      phone: normalized,
      ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
    },
    select: { id: true, nameAr: true },
  });
}

export async function findWholesaleSupplierPhoneConflict(
  db: DbClient,
  companyId: string,
  phone: string,
  excludeSupplierId?: string
) {
  const normalized = normalizePartyPhone(phone);
  return db.supplier.findFirst({
    where: {
      companyId,
      phone: normalized,
      supplierKind: SUPPLIER_KIND_WHOLESALE,
      ...(excludeSupplierId ? { id: { not: excludeSupplierId } } : {}),
    },
    select: { id: true, nameAr: true },
  });
}

export function customerPhoneConflictMessage(nameAr: string) {
  return `رقم الهاتف مسجّل مسبقاً للعميل «${nameAr}»`;
}

export function supplierPhoneConflictMessage(nameAr: string) {
  return `رقم الهاتف مسجّل مسبقاً للمورد «${nameAr}»`;
}
