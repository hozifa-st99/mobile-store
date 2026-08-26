import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function setUnitPriceBefore(
  db: Db,
  itemId: string,
  unitPriceBefore: number | null
): Promise<void> {
  if (unitPriceBefore == null) return;
  await db.$executeRaw`
    UPDATE purchase_items SET unit_price_before = ${unitPriceBefore} WHERE id = ${itemId}
  `;
}

export async function readUnitPriceBeforeByItemIds(
  db: Db,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};

  try {
    const rows = await db.$queryRaw<{ id: string; unit_price_before: number | null }[]>`
      SELECT id, unit_price_before FROM purchase_items
      WHERE id IN (${Prisma.join(itemIds)})
    `;
    const map: Record<string, number> = {};
    for (const row of rows) {
      if (row.unit_price_before != null) map[row.id] = row.unit_price_before;
    }
    return map;
  } catch {
    return {};
  }
}
