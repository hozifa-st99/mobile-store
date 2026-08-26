import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function readReturnedQuantitiesBySaleItemIds(
  db: Db,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};

  try {
    const rows = await db.$queryRaw<
      { sale_item_id: string; returned_qty: number | bigint | null }[]
    >`
      SELECT sale_item_id, SUM(quantity) AS returned_qty
      FROM sale_return_items
      WHERE sale_item_id IN (${Prisma.join(itemIds)})
      GROUP BY sale_item_id
    `;
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.sale_item_id] = Number(row.returned_qty ?? 0);
    }
    return map;
  } catch {
    return {};
  }
}

export function computeSaleReturnStatus(
  items: { quantity: number; returnedQuantity: number }[]
): "none" | "partial" | "full" {
  if (items.length === 0) return "none";
  let anyReturned = false;
  let allFull = true;
  for (const item of items) {
    const ret = item.returnedQuantity;
    if (ret > 0) anyReturned = true;
    if (ret < item.quantity) allFull = false;
  }
  if (!anyReturned) return "none";
  if (allFull) return "full";
  return "partial";
}

export async function readSaleReturnStatus(
  db: Db,
  saleIds: string[]
): Promise<Record<string, string>> {
  if (saleIds.length === 0) return {};

  try {
    const items = await db.saleItem.findMany({
      where: { saleId: { in: saleIds } },
      select: { id: true, saleId: true, quantity: true },
    });

    if (items.length === 0) {
      return Object.fromEntries(saleIds.map((id) => [id, "none"]));
    }

    const returnedMap = await readReturnedQuantitiesBySaleItemIds(
      db,
      items.map((i) => i.id)
    );

    const bySale = new Map<string, { quantity: number; returnedQuantity: number }[]>();
    for (const saleId of saleIds) {
      bySale.set(saleId, []);
    }
    for (const item of items) {
      bySale.get(item.saleId)?.push({
        quantity: item.quantity,
        returnedQuantity: returnedMap[item.id] ?? 0,
      });
    }

    const result: Record<string, string> = {};
    for (const [saleId, statusItems] of bySale) {
      result[saleId] = computeSaleReturnStatus(statusItems);
    }
    return result;
  } catch {
    return Object.fromEntries(saleIds.map((id) => [id, "none"]));
  }
}
