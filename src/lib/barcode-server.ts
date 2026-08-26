import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { barcodePrefixFromName, generateProductBarcode } from "@/lib/barcode-utils";

type Db = Prisma.TransactionClient | typeof prisma;

export async function isBarcodeTaken(
  db: Db,
  companyId: string,
  barcode: string,
  excludeProductId?: string
): Promise<boolean> {
  const trimmed = barcode.trim();
  if (!trimmed) return false;

  const existing = await db.product.findFirst({
    where: {
      companyId,
      barcode: trimmed,
      deletedAt: null,
      ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
    },
    select: { id: true },
  });

  return !!existing;
}

export async function generateUniqueProductBarcode(
  db: Db,
  companyId: string,
  nameHint?: string
): Promise<string> {
  if (!companyId) throw new Error("COMPANY_ID_REQUIRED");

  const prefix = barcodePrefixFromName(nameHint || "MS");

  for (let attempt = 0; attempt < 50; attempt++) {
    const barcode = generateProductBarcode(prefix);
    const taken = await isBarcodeTaken(db, companyId, barcode);
    if (!taken) return barcode;
  }

  throw new Error("BARCODE_GENERATE_FAILED");
}

export async function ensureUniqueBarcode(
  db: Db,
  companyId: string,
  barcode: string | null | undefined,
  nameHint?: string,
  excludeProductId?: string
): Promise<string> {
  const trimmed = barcode?.trim();
  if (trimmed) {
    const taken = await isBarcodeTaken(db, companyId, trimmed, excludeProductId);
    if (!taken) return trimmed;
  }
  return generateUniqueProductBarcode(db, companyId, nameHint);
}
