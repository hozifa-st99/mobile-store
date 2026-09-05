import type { Prisma } from "@prisma/client";

import { SUPPLIER_KIND_WHOLESALE } from "@/lib/supplier-kind";

type DbClient = Prisma.TransactionClient | { customer: Prisma.CustomerDelegate; supplier: Prisma.SupplierDelegate };

/** رموز اتجاه/تنسيق مخفية (مثل النسخ من واتساب) */
const INVISIBLE_PHONE_CHARS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function stripInvisiblePhoneChars(value: string) {
  return value.replace(INVISIBLE_PHONE_CHARS, "");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeEgyptPhoneDigits(digits: string) {
  if (digits.startsWith("0020") && digits.length > 4) {
    const national = digits.slice(4);
    return national.startsWith("0") ? national : `0${national}`;
  }
  if (digits.startsWith("20") && digits.length > 2) {
    const national = digits.slice(2);
    if (national.length === 10) return `0${national}`;
    if (national.length === 11 && national.startsWith("0")) return national;
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return `0${digits}`;
  }
  return digits;
}

/** تنظيف موحّد قبل الحفظ والمقارنة — موردين/عملاء فقط */
export function normalizePartyPhone(phone: string) {
  const stripped = stripInvisiblePhoneChars(phone).trim();
  if (!stripped) return "";

  const digits = digitsOnly(stripped);
  if (!digits) return "";

  return normalizeEgyptPhoneDigits(digits);
}

function findNormalizedPhoneConflict<
  T extends { id: string; nameAr: string; phone: string | null }
>(rows: T[], normalized: string, excludeId?: string) {
  return (
    rows.find(
      (row) =>
        row.id !== excludeId &&
        row.phone != null &&
        normalizePartyPhone(row.phone) === normalized
    ) ?? null
  );
}

export async function findCustomerPhoneConflict(
  db: DbClient,
  companyId: string,
  phone: string,
  excludeCustomerId?: string
) {
  const normalized = normalizePartyPhone(phone);
  if (!normalized) return null;

  const rows = await db.customer.findMany({
    where: {
      companyId,
      phone: { not: null },
      ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
    },
    select: { id: true, nameAr: true, phone: true },
  });

  return findNormalizedPhoneConflict(rows, normalized);
}

export async function findWholesaleSupplierPhoneConflict(
  db: DbClient,
  companyId: string,
  phone: string,
  excludeSupplierId?: string
) {
  const normalized = normalizePartyPhone(phone);
  if (!normalized) return null;

  const rows = await db.supplier.findMany({
    where: {
      companyId,
      phone: { not: null },
      supplierKind: SUPPLIER_KIND_WHOLESALE,
      ...(excludeSupplierId ? { id: { not: excludeSupplierId } } : {}),
    },
    select: { id: true, nameAr: true, phone: true },
  });

  return findNormalizedPhoneConflict(rows, normalized);
}

export function customerPhoneConflictMessage(nameAr: string) {
  return `رقم الهاتف مسجّل مسبقاً للعميل «${nameAr}»`;
}

export function supplierPhoneConflictMessage(nameAr: string) {
  return `رقم الهاتف مسجّل مسبقاً للمورد «${nameAr}»`;
}
