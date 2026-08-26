import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateStocktakeDocumentNumber } from "@/lib/stocktake-document-number-server";
import { formatImeisSnapshot } from "@/lib/purchase-return-number";
import {
  serializeStocktakeSerials,
  type StocktakeSerialSnapshot,
} from "@/lib/stocktake-serial-snapshot";
import {
  countAvailablePhoneSerials,
  deleteDeviceSerialById,
  findDeviceSerialByImei,
  syncPhoneInventoryQuantity,
} from "@/lib/product-serial-service";

type Db = Prisma.TransactionClient | typeof prisma;

export interface StocktakeSubmitItem {
  productId: string;
  description: string;
  barcode?: string | null;
  imeis?: string[];
  serials?: StocktakeSerialSnapshot[];
  presentSerialIds?: string[];
  absentSerialIds?: string[];
  systemQuantity: number;
  countedQuantity: number;
  unitCost: number;
}

export interface CompleteStocktakeInput {
  branchId: string;
  userId: string;
  companyId: string;
  mode: "full" | "partial";
  notes?: string | null;
  documentNumber?: string;
  items: StocktakeSubmitItem[];
}

export interface CompleteStocktakeResult {
  id: string;
  documentNumber: string;
  totalSystemQty: number;
  totalCountedQty: number;
  totalVariance: number;
}

async function createStocktakeRecord(
  db: Db,
  data: {
    id: string;
    branchId: string;
    userId: string;
    documentNumber: string;
    mode: string;
    notes: string | null;
    totalSystemQty: number;
    totalCountedQty: number;
    totalVariance: number;
  }
) {
  try {
    return await db.stocktake.create({
      data: {
        id: data.id,
        branchId: data.branchId,
        userId: data.userId,
        documentNumber: data.documentNumber,
        mode: data.mode,
        status: "completed",
        notes: data.notes,
        totalSystemQty: data.totalSystemQty,
        totalCountedQty: data.totalCountedQty,
        totalVariance: data.totalVariance,
      },
    });
  } catch {
    await db.$executeRaw`
      INSERT INTO stocktakes (
        id, branch_id, user_id, document_number, stocktake_date, mode, status, notes,
        total_system_qty, total_counted_qty, total_variance, created_at, updated_at
      ) VALUES (
        ${data.id},
        ${data.branchId},
        ${data.userId},
        ${data.documentNumber},
        ${new Date()},
        ${data.mode},
        'completed',
        ${data.notes},
        ${data.totalSystemQty},
        ${data.totalCountedQty},
        ${data.totalVariance},
        ${new Date()},
        ${new Date()}
      )
    `;
  }
}

async function deleteAbsentPhoneSerials(
  tx: Db,
  branchId: string,
  productId: string,
  item: StocktakeSubmitItem
): Promise<number> {
  const absentSnapshots = (item.serials ?? []).filter((serial) => !serial.present);
  const deleted = new Set<string>();

  for (const snap of absentSnapshots) {
    for (const imei of snap.imeis) {
      const found = await findDeviceSerialByImei(tx, branchId, imei, {
        productId,
        status: "available",
      });
      if (!found || deleted.has(found.id)) continue;
      await deleteDeviceSerialById(tx, found.id);
      deleted.add(found.id);
    }
  }

  for (const serialId of item.absentSerialIds ?? []) {
    if (deleted.has(serialId)) continue;
    const existing = await tx.productSerial.findUnique({
      where: { id: serialId },
      select: { id: true, branchId: true, productId: true, status: true },
    });
    if (
      existing &&
      existing.branchId === branchId &&
      existing.productId === productId &&
      existing.status === "available"
    ) {
      await deleteDeviceSerialById(tx, existing.id);
      deleted.add(existing.id);
    }
  }

  return deleted.size;
}

async function createStocktakeItemRecord(
  db: Db,
  data: {
    id: string;
    stocktakeId: string;
    productId: string;
    description: string;
    barcode: string | null;
    imeiSnapshot: string | null;
    serialsSnapshot: string | null;
    systemQuantity: number;
    countedQuantity: number;
    variance: number;
    unitCost: number;
  }
) {
  try {
    await db.stocktakeItem.create({ data });
  } catch {
    await db.$executeRaw`
      INSERT INTO stocktake_items (
        id, stocktake_id, product_id, description, barcode, imei_snapshot, serials_snapshot,
        system_quantity, counted_quantity, variance, unit_cost
      ) VALUES (
        ${data.id},
        ${data.stocktakeId},
        ${data.productId},
        ${data.description},
        ${data.barcode},
        ${data.imeiSnapshot},
        ${data.serialsSnapshot},
        ${data.systemQuantity},
        ${data.countedQuantity},
        ${data.variance},
        ${data.unitCost}
      )
    `;
  }
}

export async function completeStocktake(
  input: CompleteStocktakeInput
): Promise<CompleteStocktakeResult> {
  if (input.items.length === 0) {
    throw new Error("NO_ITEMS");
  }

  for (const item of input.items) {
    if (item.countedQuantity < 0) throw new Error("INVALID_COUNT");
    const inventory = await prisma.branchInventory.findUnique({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: item.productId,
        },
      },
      include: { product: { select: { companyId: true, deletedAt: true } } },
    });
    if (
      !inventory?.product ||
      inventory.product.companyId !== input.companyId ||
      inventory.product.deletedAt
    ) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
  }

  const totals = input.items.reduce(
    (acc, item) => {
      const variance = item.countedQuantity - item.systemQuantity;
      acc.totalSystemQty += item.systemQuantity;
      acc.totalCountedQty += item.countedQuantity;
      acc.totalVariance += variance;
      return acc;
    },
    { totalSystemQty: 0, totalCountedQty: 0, totalVariance: 0 }
  );

  const stocktakeId = crypto.randomUUID();

  return prisma.$transaction(async (tx) => {
    const documentNumber = await allocateStocktakeDocumentNumber(
      tx,
      input.branchId,
      input.documentNumber
    );

    await createStocktakeRecord(tx, {
      id: stocktakeId,
      branchId: input.branchId,
      userId: input.userId,
      documentNumber,
      mode: input.mode,
      notes: input.notes?.trim() || null,
      ...totals,
    });

    for (const item of input.items) {
      const variance = item.countedQuantity - item.systemQuantity;
      const itemId = crypto.randomUUID();
      const imeiSnapshot = formatImeisSnapshot(item.imeis ?? []) || null;
      const serialsSnapshot = serializeStocktakeSerials(item.serials ?? []);

      await createStocktakeItemRecord(tx, {
        id: itemId,
        stocktakeId,
        productId: item.productId,
        description: item.description,
        barcode: item.barcode?.trim() || null,
        imeiSnapshot,
        serialsSnapshot,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity,
        variance,
        unitCost: item.unitCost,
      });

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { type: true },
      });
      const isPhone = product?.type === "phone";
      const hasSerialTracking =
        isPhone &&
        ((item.presentSerialIds?.length ?? 0) > 0 || (item.absentSerialIds?.length ?? 0) > 0);

      if (isPhone) {
        const absentSnapshots = (item.serials ?? []).filter((serial) => !serial.present);
        let deletedCount = 0;

        if (item.absentSerialIds?.length || absentSnapshots.length > 0) {
          deletedCount = await deleteAbsentPhoneSerials(tx, input.branchId, item.productId, item);
        } else if (variance < 0) {
          let availableCount = await countAvailablePhoneSerials(tx, input.branchId, item.productId);
          const targetCount = Math.max(0, item.countedQuantity);

          if (availableCount > targetCount) {
            const serialsToRemove = await tx.productSerial.findMany({
              where: {
                branchId: input.branchId,
                productId: item.productId,
                status: "available",
              },
              select: { id: true },
              orderBy: { createdAt: "asc" },
              take: availableCount - targetCount,
            });

            for (const serial of serialsToRemove) {
              await deleteDeviceSerialById(tx, serial.id);
            }
          }
        }

        await syncPhoneInventoryQuantity(tx, input.branchId, item.productId);

        if (variance < 0 && deletedCount === 0 && absentSnapshots.length > 0) {
          throw new Error("STOCKTAKE_SERIAL_DELETE_FAILED");
        }
      } else if (variance !== 0 || hasSerialTracking) {
        await tx.branchInventory.update({
          where: {
            branchId_productId: {
              branchId: input.branchId,
              productId: item.productId,
            },
          },
          data: { quantity: item.countedQuantity },
        });
      }
    }

    return {
      id: stocktakeId,
      documentNumber,
      ...totals,
    };
  });
}

export async function getStocktakeDetail(
  branchId: string,
  companyId: string,
  id: string
) {
  let stocktake:
    | (Awaited<ReturnType<typeof prisma.stocktake.findFirst>> & {
        user?: { fullNameAr: string | null; username: string } | null;
        items?: Array<{
          id: string;
          productId: string;
          description: string;
          barcode: string | null;
          imeiSnapshot: string | null;
          serialsSnapshot: string | null;
          systemQuantity: number;
          countedQuantity: number;
          variance: number;
          unitCost: number;
        }>;
      })
    | null = null;

  try {
    stocktake = await prisma.stocktake.findFirst({
      where: { id, branchId },
      include: {
        user: { select: { fullNameAr: true, username: true } },
        items: { orderBy: { description: "asc" } },
      },
    });
  } catch {
    const rows = await prisma.$queryRaw<
      {
        id: string;
        document_number: string;
        stocktake_date: string;
        mode: string;
        notes: string | null;
        total_system_qty: number;
        total_counted_qty: number;
        total_variance: number;
        user_id: string | null;
      }[]
    >`
      SELECT id, document_number, stocktake_date, mode, notes,
             total_system_qty, total_counted_qty, total_variance, user_id
      FROM stocktakes
      WHERE id = ${id} AND branch_id = ${branchId}
      LIMIT 1
    `;
    if (rows[0]) {
      const itemRows = await prisma.$queryRaw<
        {
          id: string;
          product_id: string;
          description: string;
          barcode: string | null;
          imei_snapshot: string | null;
          serials_snapshot: string | null;
          system_quantity: number;
          counted_quantity: number;
          variance: number;
          unit_cost: number;
        }[]
      >`
        SELECT id, product_id, description, barcode, imei_snapshot, serials_snapshot,
               system_quantity, counted_quantity, variance, unit_cost
        FROM stocktake_items
        WHERE stocktake_id = ${id}
        ORDER BY description ASC
      `;
      stocktake = {
        id: rows[0].id,
        branchId,
        userId: rows[0].user_id,
        documentNumber: rows[0].document_number,
        stocktakeDate: new Date(rows[0].stocktake_date),
        mode: rows[0].mode,
        status: "completed",
        notes: rows[0].notes,
        totalSystemQty: Number(rows[0].total_system_qty),
        totalCountedQty: Number(rows[0].total_counted_qty),
        totalVariance: Number(rows[0].total_variance),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        items: itemRows.map((row) => ({
          id: row.id,
          productId: row.product_id,
          description: row.description,
          barcode: row.barcode,
          imeiSnapshot: row.imei_snapshot,
          serialsSnapshot: row.serials_snapshot,
          systemQuantity: Number(row.system_quantity),
          countedQuantity: Number(row.counted_quantity),
          variance: Number(row.variance),
          unitCost: Number(row.unit_cost),
        })),
      } as typeof stocktake;
    }
  }

  if (!stocktake) return null;

  const productIds = stocktake.items?.map((item) => item.productId) ?? [];
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, companyId },
          select: { id: true },
        })
      : [];
  if (products.length !== productIds.length) return null;

  return stocktake;
}
