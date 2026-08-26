import { Prisma, type Prisma as PrismaNamespace } from "@prisma/client";

import { getCogsBySaleReturnIds } from "@/lib/dashboard-metrics";
import { prisma } from "@/lib/prisma";
import { buildAllTreasuryTransactions, type TreasuryTransaction } from "@/lib/treasury-ledger";

type Db = PrismaNamespace.TransactionClient | typeof prisma;

export interface OpenShiftHourlyPoint {
  hour: string;
  hourKey: number;
  sales: number;
  profit: number;
}

async function getDepositedEntryKeys(db: Db, branchId: string): Promise<Set<string>> {
  try {
    const rows = await db.treasuryShiftEntry.findMany({
      where: { shift: { branchId } },
      select: { entryKey: true },
    });
    return new Set(rows.map((row) => row.entryKey));
  } catch {
    return new Set();
  }
}

function hourBucketStart(date: Date): Date {
  const bucket = new Date(date);
  bucket.setMinutes(0, 0, 0);
  return bucket;
}

function formatHourLabel(date: Date): string {
  return date.toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getCogsBySaleIds(
  db: Db,
  branchId: string,
  saleIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (saleIds.length === 0) return map;

  try {
    const rows = await db.$queryRaw<{ sale_id: string; total: number | null }[]>`
      SELECT
        si.sale_id AS sale_id,
        COALESCE(SUM(
          si.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
        ), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND s.status = 'completed'
        AND si.sale_id IN (${Prisma.join(saleIds)})
      GROUP BY si.sale_id
    `;

    for (const row of rows) {
      map.set(row.sale_id, Math.round(Number(row.total ?? 0) * 100) / 100);
    }
  } catch {
    /* ignore */
  }

  return map;
}

function aggregatePendingByHour(pending: TreasuryTransaction[]) {
  const salesByHour = new Map<number, number>();
  const expensesByHour = new Map<number, number>();
  const saleIdsByHour = new Map<number, string[]>();
  const saleReturnIdsByHour = new Map<number, string[]>();
  let minHourKey: number | null = null;
  let maxHourKey: number | null = null;

  const touchHour = (date: Date) => {
    const key = hourBucketStart(date).getTime();
    if (minHourKey == null || key < minHourKey) minHourKey = key;
    if (maxHourKey == null || key > maxHourKey) maxHourKey = key;
    if (!salesByHour.has(key)) {
      salesByHour.set(key, 0);
      expensesByHour.set(key, 0);
      saleIdsByHour.set(key, []);
      saleReturnIdsByHour.set(key, []);
    }
    return key;
  };

  for (const row of pending) {
    const key = touchHour(new Date(row.date));
    if (row.type === "sale") {
      salesByHour.set(key, Math.round(((salesByHour.get(key) || 0) + row.amount) * 100) / 100);
      saleIdsByHour.get(key)!.push(row.id);
    } else if (row.type === "sale_return") {
      salesByHour.set(key, Math.round(((salesByHour.get(key) || 0) - row.amount) * 100) / 100);
      saleReturnIdsByHour.get(key)!.push(row.id);
    } else if (row.type === "expense") {
      expensesByHour.set(
        key,
        Math.round(((expensesByHour.get(key) || 0) + row.amount) * 100) / 100
      );
    }
  }

  return {
    salesByHour,
    expensesByHour,
    saleIdsByHour,
    saleReturnIdsByHour,
    minHourKey,
    maxHourKey,
  };
}

export async function computeOpenShiftHourlyChart(
  branchId: string
): Promise<OpenShiftHourlyPoint[]> {
  const [allRows, depositedKeys] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    getDepositedEntryKeys(prisma, branchId),
  ]);

  const pending = allRows.filter((row) => !depositedKeys.has(row.id));
  if (pending.length === 0) return [];

  const { salesByHour, expensesByHour, saleIdsByHour, saleReturnIdsByHour, minHourKey, maxHourKey } =
    aggregatePendingByHour(pending);

  if (minHourKey == null || maxHourKey == null) return [];

  const nowBucket = hourBucketStart(new Date()).getTime();
  const endHourKey = Math.max(maxHourKey, nowBucket);

  const allSaleIds = pending.filter((row) => row.type === "sale").map((row) => row.id);
  const allSaleReturnIds = pending
    .filter((row) => row.type === "sale_return")
    .map((row) => row.id);
  const [cogsBySaleId, cogsBySaleReturnId] = await Promise.all([
    getCogsBySaleIds(prisma, branchId, allSaleIds),
    getCogsBySaleReturnIds(prisma, branchId, allSaleReturnIds),
  ]);

  const points: OpenShiftHourlyPoint[] = [];

  for (let hourKey = minHourKey; hourKey <= endHourKey; hourKey += 60 * 60 * 1000) {
    const sales = salesByHour.get(hourKey) || 0;
    const expenses = expensesByHour.get(hourKey) || 0;
    const saleIds = saleIdsByHour.get(hourKey) || [];
    const saleReturnIds = saleReturnIdsByHour.get(hourKey) || [];
    const salesCogs = saleIds.reduce((sum, saleId) => sum + (cogsBySaleId.get(saleId) || 0), 0);
    const returnCogs = saleReturnIds.reduce(
      (sum, returnId) => sum + (cogsBySaleReturnId.get(returnId) || 0),
      0
    );
    const cogs = Math.round((salesCogs - returnCogs) * 100) / 100;
    const profit = Math.round((sales - cogs - expenses) * 100) / 100;
    const labelDate = new Date(hourKey);

    points.push({
      hour: formatHourLabel(labelDate),
      hourKey,
      sales,
      profit,
    });
  }

  return points;
}
