import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export interface RetailPriceChangeRecord {
  id: string;
  branchId: string;
  productId: string;
  serialId: string | null;
  imei: string | null;
  userId: string | null;
  oldPrice: number;
  newPrice: number;
  reason: string;
  changedAt: Date;
}

export async function createRetailPriceChange(
  db: Db,
  data: {
    branchId: string;
    productId: string;
    userId?: string | null;
    serialId?: string | null;
    imei?: string | null;
    oldPrice: number;
    newPrice: number;
    reason: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  try {
    await db.$executeRaw`
      INSERT INTO retail_price_changes (
        id, branch_id, product_id, serial_id, imei, user_id, old_price, new_price, reason, changed_at
      ) VALUES (
        ${id},
        ${data.branchId},
        ${data.productId},
        ${data.serialId ?? null},
        ${data.imei ?? null},
        ${data.userId ?? null},
        ${data.oldPrice},
        ${data.newPrice},
        ${data.reason},
        ${new Date()}
      )
    `;
  } catch {
    await db.$executeRaw`
      INSERT INTO retail_price_changes (
        id, branch_id, product_id, user_id, old_price, new_price, reason, changed_at
      ) VALUES (
        ${id},
        ${data.branchId},
        ${data.productId},
        ${data.userId ?? null},
        ${data.oldPrice},
        ${data.newPrice},
        ${data.reason},
        ${new Date()}
      )
    `;
  }
}

export async function listRetailPriceChanges(
  db: Db,
  branchId: string,
  productId: string
): Promise<RetailPriceChangeRecord[]> {
  try {
    const rows = await db.$queryRaw<
      {
        id: string;
        branch_id: string;
        product_id: string;
        serial_id: string | null;
        imei: string | null;
        user_id: string | null;
        old_price: number;
        new_price: number;
        reason: string;
        changed_at: string;
      }[]
    >`
      SELECT id, branch_id, product_id, serial_id, imei, user_id, old_price, new_price, reason, changed_at
      FROM retail_price_changes
      WHERE branch_id = ${branchId} AND product_id = ${productId}
      ORDER BY changed_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      productId: row.product_id,
      serialId: row.serial_id,
      imei: row.imei,
      userId: row.user_id,
      oldPrice: Number(row.old_price),
      newPrice: Number(row.new_price),
      reason: row.reason,
      changedAt: new Date(row.changed_at),
    }));
  } catch {
    try {
      const rows = await db.$queryRaw<
        {
          id: string;
          branch_id: string;
          product_id: string;
          user_id: string | null;
          old_price: number;
          new_price: number;
          reason: string;
          changed_at: string;
        }[]
      >`
        SELECT id, branch_id, product_id, user_id, old_price, new_price, reason, changed_at
        FROM retail_price_changes
        WHERE branch_id = ${branchId} AND product_id = ${productId}
        ORDER BY changed_at DESC
      `;

      return rows.map((row) => ({
        id: row.id,
        branchId: row.branch_id,
        productId: row.product_id,
        serialId: null,
        imei: null,
        userId: row.user_id,
        oldPrice: Number(row.old_price),
        newPrice: Number(row.new_price),
        reason: row.reason,
        changedAt: new Date(row.changed_at),
      }));
    } catch {
      return [];
    }
  }
}
