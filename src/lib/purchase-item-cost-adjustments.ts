import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** مجموع الزيادة لكل وحدة من توزيعات مصروف المرتجعات السابقة */
export async function readPerUnitIncreaseByItemIds(
  db: Db,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};

  try {
    const rows = await db.$queryRaw<
      { purchase_item_id: string; total_increase: number | null }[]
    >`
      SELECT purchase_item_id, SUM(per_unit_increase) AS total_increase
      FROM purchase_item_cost_adjustments
      WHERE purchase_item_id IN (${Prisma.join(itemIds)})
      GROUP BY purchase_item_id
    `;
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.purchase_item_id] = Number(row.total_increase ?? 0);
    }
    return map;
  } catch {
    return {};
  }
}

/** عرض فقط: سعر سطر الفاتورة + توزيعات مرتجعات نفس السطر — بدون سعر المخزون */
export async function readInvoiceScopedEffectiveUnitPrices(
  db: Db,
  items: { id: string; unitPrice: number }[]
): Promise<Record<string, number>> {
  if (items.length === 0) return {};

  const increaseMap = await readPerUnitIncreaseByItemIds(
    db,
    items.map((item) => item.id)
  );

  const map: Record<string, number> = {};
  for (const item of items) {
    const increase = increaseMap[item.id] ?? 0;
    map[item.id] = Math.round((item.unitPrice + increase) * 100) / 100;
  }
  return map;
}

/** السعر الفعلي «بعد المصروف» = سعر الفاتورة الأصلي + توزيعات المرتجعات */
export async function readEffectiveUnitPricesAfter(
  db: Db,
  items: { id: string; unitPrice: number; productId?: string | null }[],
  branchId?: string
): Promise<Record<string, number>> {
  if (items.length === 0) return {};

  const increaseMap = await readPerUnitIncreaseByItemIds(
    db,
    items.map((i) => i.id)
  );

  let inventoryMap = new Map<string, number>();
  if (branchId) {
    const productIds = items
      .map((i) => i.productId)
      .filter((id): id is string => Boolean(id));
    if (productIds.length > 0) {
      try {
        const rows = await db.branchInventory.findMany({
          where: { branchId, productId: { in: productIds } },
          select: { productId: true, purchasePrice: true },
        });
        inventoryMap = new Map(rows.map((r) => [r.productId, r.purchasePrice]));
      } catch {
        inventoryMap = new Map();
      }
    }
  }

  const map: Record<string, number> = {};
  for (const item of items) {
    const increase = increaseMap[item.id] ?? 0;
    if (increase > 0.0001) {
      map[item.id] = Math.round((item.unitPrice + increase) * 100) / 100;
      continue;
    }
    const invPrice =
      item.productId != null ? inventoryMap.get(item.productId) : undefined;
    if (invPrice != null && invPrice > item.unitPrice + 0.001) {
      map[item.id] = Math.round(invPrice * 100) / 100;
    } else {
      map[item.id] = item.unitPrice;
    }
  }
  return map;
}

export async function recordPurchaseItemCostAdjustments(
  db: Db,
  purchaseReturnId: string,
  adjustments: { purchaseItemId: string; perUnitIncrease: number }[]
): Promise<void> {
  const toInsert = adjustments.filter((a) => a.perUnitIncrease > 0.0001);
  if (toInsert.length === 0) return;

  for (const row of toInsert) {
    const id = randomUUID();
    const rounded = Math.round(row.perUnitIncrease * 10000) / 10000;
    try {
      await db.purchaseItemCostAdjustment.create({
        data: {
          id,
          purchaseItemId: row.purchaseItemId,
          purchaseReturnId,
          perUnitIncrease: rounded,
        },
      });
    } catch {
      await db.$executeRaw`
        INSERT INTO purchase_item_cost_adjustments (
          id, purchase_item_id, purchase_return_id, per_unit_increase, created_at
        ) VALUES (
          ${id}, ${row.purchaseItemId}, ${purchaseReturnId}, ${rounded}, ${new Date()}
        )
      `;
    }
  }
}
