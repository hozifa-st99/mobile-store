import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatImeisSnapshot } from "@/lib/purchase-return-number";

type Db = Prisma.TransactionClient | typeof prisma;

export async function setImeisSnapshot(
  db: Db,
  itemId: string,
  imeis: string[]
): Promise<void> {
  const snapshot = formatImeisSnapshot(imeis);
  if (!snapshot) return;
  await db.$executeRaw`
    UPDATE purchase_items SET imeis_snapshot = ${snapshot} WHERE id = ${itemId}
  `;
}

/** IMEI snapshot on original invoice line (set at posting, not modified on return). */
export async function readPurchaseItemImeisSnapshots(
  db: Db,
  itemIds: string[]
): Promise<Record<string, string | null>> {
  if (itemIds.length === 0) return {};

  try {
    const rows = await db.$queryRaw<{ id: string; imeis_snapshot: string | null }[]>`
      SELECT id, imeis_snapshot FROM purchase_items
      WHERE id IN (${Prisma.join(itemIds)})
    `;
    const map: Record<string, string | null> = {};
    for (const row of rows) {
      map[row.id] = row.imeis_snapshot ?? null;
    }
    return map;
  } catch {
    return {};
  }
}

/** Returned quantities aggregated from independent return documents only. */
export async function readReturnedQuantitiesByItemIds(
  db: Db,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};

  try {
    const rows = await db.$queryRaw<
      { purchase_item_id: string; returned_qty: number | bigint | null }[]
    >`
      SELECT purchase_item_id, SUM(quantity) AS returned_qty
      FROM purchase_return_items
      WHERE purchase_item_id IN (${Prisma.join(itemIds)})
      GROUP BY purchase_item_id
    `;
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.purchase_item_id] = Number(row.returned_qty ?? 0);
    }
    return map;
  } catch {
    return {};
  }
}

export async function readPurchaseItemReturnFields(
  db: Db,
  itemIds: string[]
): Promise<Record<string, { returnedQuantity: number; imeisSnapshot: string | null }>> {
  const [imeisMap, returnedMap] = await Promise.all([
    readPurchaseItemImeisSnapshots(db, itemIds),
    readReturnedQuantitiesByItemIds(db, itemIds),
  ]);

  const map: Record<string, { returnedQuantity: number; imeisSnapshot: string | null }> = {};
  for (const id of itemIds) {
    map[id] = {
      returnedQuantity: returnedMap[id] ?? 0,
      imeisSnapshot: imeisMap[id] ?? null,
    };
  }
  return map;
}

export function computePurchaseReturnStatus(
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

/** Return status derived from return documents, not stored on purchase row. */
export async function readPurchaseReturnStatus(
  db: Db,
  purchaseIds: string[]
): Promise<Record<string, string>> {
  if (purchaseIds.length === 0) return {};

  try {
    const items = await db.purchaseItem.findMany({
      where: { purchaseId: { in: purchaseIds } },
      select: { id: true, purchaseId: true, quantity: true },
    });

    if (items.length === 0) {
      return Object.fromEntries(purchaseIds.map((id) => [id, "none"]));
    }

    const returnedMap = await readReturnedQuantitiesByItemIds(
      db,
      items.map((i) => i.id)
    );

    const byPurchase = new Map<string, { quantity: number; returnedQuantity: number }[]>();
    for (const purchaseId of purchaseIds) {
      byPurchase.set(purchaseId, []);
    }
    for (const item of items) {
      byPurchase.get(item.purchaseId)?.push({
        quantity: item.quantity,
        returnedQuantity: returnedMap[item.id] ?? 0,
      });
    }

    const map: Record<string, string> = {};
    for (const purchaseId of purchaseIds) {
      map[purchaseId] = computePurchaseReturnStatus(byPurchase.get(purchaseId) ?? []);
    }
    return map;
  } catch {
    return Object.fromEntries(purchaseIds.map((id) => [id, "none"]));
  }
}
