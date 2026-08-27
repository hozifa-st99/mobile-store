import { Prisma, type Prisma as PrismaNamespace } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaNamespace.TransactionClient | typeof prisma;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function sumPurchaseReturnsSince(
  db: Db,
  branchId: string,
  since: Date
): Promise<number> {
  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM purchase_returns
      WHERE branch_id = ${branchId}
        AND return_date >= ${since}
    `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function sumPurchaseReturnsInRange(
  db: Db,
  branchId: string,
  from: Date,
  to: Date
): Promise<number> {
  const breakdown = await sumPurchaseReturnCashBreakdownInRange(db, branchId, from, to);
  return breakdown.total;
}

export interface PurchaseReturnCashBreakdown {
  subtotal: number;
  expenseRecovered: number;
  total: number;
}

export async function sumPurchaseReturnCashBreakdownSince(
  db: Db,
  branchId: string,
  since: Date
): Promise<PurchaseReturnCashBreakdown> {
  try {
    const rows = await db.$queryRaw<
      { subtotal: number | null; expense_recovered: number | null; total: number | null }[]
    >`
      SELECT
        COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(expense_recovered_amount), 0) AS expense_recovered,
        COALESCE(SUM(total), 0) AS total
      FROM purchase_returns
      WHERE branch_id = ${branchId}
        AND return_date >= ${since}
    `;
    return {
      subtotal: Number(rows[0]?.subtotal ?? 0),
      expenseRecovered: Number(rows[0]?.expense_recovered ?? 0),
      total: Number(rows[0]?.total ?? 0),
    };
  } catch {
    return { subtotal: 0, expenseRecovered: 0, total: 0 };
  }
}

export async function sumPurchaseReturnCashBreakdownInRange(
  db: Db,
  branchId: string,
  from: Date,
  to: Date
): Promise<PurchaseReturnCashBreakdown> {
  try {
    const rows = await db.$queryRaw<
      { subtotal: number | null; expense_recovered: number | null; total: number | null }[]
    >`
      SELECT
        COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(expense_recovered_amount), 0) AS expense_recovered,
        COALESCE(SUM(total), 0) AS total
      FROM purchase_returns
      WHERE branch_id = ${branchId}
        AND return_date >= ${from}
        AND return_date <= ${to}
    `;
    return {
      subtotal: Number(rows[0]?.subtotal ?? 0),
      expenseRecovered: Number(rows[0]?.expense_recovered ?? 0),
      total: Number(rows[0]?.total ?? 0),
    };
  } catch {
    return { subtotal: 0, expenseRecovered: 0, total: 0 };
  }
}

export async function sumSaleReturnsSince(
  db: Db,
  branchId: string,
  since: Date
): Promise<number> {
  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM sale_returns
      WHERE branch_id = ${branchId}
        AND return_date >= ${since}
    `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function sumSaleReturnsInRange(
  db: Db,
  branchId: string,
  from: Date,
  to: Date
): Promise<number> {
  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM sale_returns
      WHERE branch_id = ${branchId}
        AND return_date >= ${from}
        AND return_date <= ${to}
    `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export function netPurchasesTotal(gross: number, returns: number): number {
  return Math.max(0, Math.round((gross - returns) * 100) / 100);
}

/** النقدي الفعلي — مطابق لصافي الوردية المفتوحة في شاشة الخزنة */
export function computeActualCash(input: {
  salesTotal: number;
  expensesTotal: number;
  purchasesGross: number;
  purchaseDebtPaymentsTotal?: number;
  purchaseReturnsTotal: number;
  saleReturnsTotal: number;
}): number {
  const {
    salesTotal,
    expensesTotal,
    purchasesGross,
    purchaseDebtPaymentsTotal = 0,
    purchaseReturnsTotal,
    saleReturnsTotal,
  } = input;

  return Math.round(
    (salesTotal -
      expensesTotal -
      purchasesGross -
      purchaseDebtPaymentsTotal +
      purchaseReturnsTotal -
      saleReturnsTotal) *
      100
  ) / 100;
}

/** تكلفة بنود فواتير مبيعات محددة */
export async function sumCogsForSaleIds(
  db: Db,
  branchId: string,
  saleIds: string[]
): Promise<number> {
  if (saleIds.length === 0) return 0;

  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(
        si.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
      ), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND s.status = 'completed'
        AND si.sale_id IN (${Prisma.join(saleIds)})
    `;
    return roundMoney(Number(rows[0]?.total ?? 0));
  } catch {
    return 0;
  }
}

/** تكلفة بنود مرتجعات مبيعات محددة (نفس منطق التكلفة وقت البيع) */
export async function sumCogsForSaleReturnIds(
  db: Db,
  branchId: string,
  saleReturnIds: string[]
): Promise<number> {
  if (saleReturnIds.length === 0) return 0;

  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(
        sri.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
      ), 0) AS total
      FROM sale_return_items sri
      INNER JOIN sale_returns sr ON sr.id = sri.sale_return_id
      INNER JOIN sale_items si ON si.id = sri.sale_item_id
      INNER JOIN sales s ON s.id = sr.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND sr.id IN (${Prisma.join(saleReturnIds)})
    `;
    return roundMoney(Number(rows[0]?.total ?? 0));
  } catch {
    return 0;
  }
}

export async function getCogsBySaleReturnIds(
  db: Db,
  branchId: string,
  saleReturnIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (saleReturnIds.length === 0) return map;

  try {
    const rows = await db.$queryRaw<{ sale_return_id: string; total: number | null }[]>`
      SELECT
        sr.id AS sale_return_id,
        COALESCE(SUM(
          sri.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
        ), 0) AS total
      FROM sale_return_items sri
      INNER JOIN sale_returns sr ON sr.id = sri.sale_return_id
      INNER JOIN sale_items si ON si.id = sri.sale_item_id
      INNER JOIN sales s ON s.id = sr.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND sr.id IN (${Prisma.join(saleReturnIds)})
      GROUP BY sr.id
    `;

    for (const row of rows) {
      map.set(row.sale_return_id, roundMoney(Number(row.total ?? 0)));
    }
  } catch {
    /* ignore */
  }

  return map;
}

/** تكلفة البضاعة المباعة = كمية × سعر الشراء وقت البيع */
export async function sumCogsSince(
  db: Db,
  branchId: string,
  since: Date
): Promise<number> {
  const sinceMs = since.getTime();
  const sinceIso = since.toISOString();

  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(
        si.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
      ), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND s.status = 'completed'
        AND (
          (typeof(s.sale_date) = 'integer' AND s.sale_date >= ${sinceMs})
          OR (typeof(s.sale_date) = 'text' AND s.sale_date >= ${sinceIso})
        )
    `;
    return Math.round(Number(rows[0]?.total ?? 0) * 100) / 100;
  } catch {
    return 0;
  }
}

export async function sumCogsInRange(
  db: Db,
  branchId: string,
  from: Date,
  to: Date
): Promise<number> {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  try {
    const rows = await db.$queryRaw<{ total: number | null }[]>`
      SELECT COALESCE(SUM(
        si.quantity * COALESCE(NULLIF(si.unit_cost, 0), bi.purchase_price, 0)
      ), 0) AS total
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      LEFT JOIN branch_inventories bi
        ON bi.product_id = si.product_id AND bi.branch_id = s.branch_id
      WHERE s.branch_id = ${branchId}
        AND s.status = 'completed'
        AND (
          (typeof(s.sale_date) = 'integer' AND s.sale_date >= ${fromMs} AND s.sale_date <= ${toMs})
          OR (typeof(s.sale_date) = 'text' AND s.sale_date >= ${fromIso} AND s.sale_date <= ${toIso})
        )
    `;
    return Math.round(Number(rows[0]?.total ?? 0) * 100) / 100;
  } catch {
    return 0;
  }
}

export async function sumExpensesSince(
  db: Db,
  branchId: string,
  since: Date,
  options?: { includeReturnLinked?: boolean }
): Promise<number> {
  const sinceMs = since.getTime();
  const sinceIso = since.toISOString();
  const excludeReturnLinked = !options?.includeReturnLinked;

  try {
    const rows = excludeReturnLinked
      ? await db.$queryRaw<{ total: number | null }[]>`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
          WHERE branch_id = ${branchId}
            AND (
              (typeof(expense_date) = 'integer' AND expense_date >= ${sinceMs})
              OR (typeof(expense_date) = 'text' AND expense_date >= ${sinceIso})
            )
            AND purchase_return_id IS NULL
        `
      : await db.$queryRaw<{ total: number | null }[]>`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
          WHERE branch_id = ${branchId}
            AND (
              (typeof(expense_date) = 'integer' AND expense_date >= ${sinceMs})
              OR (typeof(expense_date) = 'text' AND expense_date >= ${sinceIso})
            )
        `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    try {
      const rows = await db.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE branch_id = ${branchId}
          AND (
            (typeof(expense_date) = 'integer' AND expense_date >= ${sinceMs})
            OR (typeof(expense_date) = 'text' AND expense_date >= ${sinceIso})
          )
      `;
      return Number(rows[0]?.total ?? 0);
    } catch {
      return 0;
    }
  }
}

export async function sumExpensesInRange(
  db: Db,
  branchId: string,
  from: Date,
  to: Date,
  options?: { includeReturnLinked?: boolean }
): Promise<number> {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const excludeReturnLinked = !options?.includeReturnLinked;

  try {
    const rows = excludeReturnLinked
      ? await db.$queryRaw<{ total: number | null }[]>`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
          WHERE branch_id = ${branchId}
            AND (
              (typeof(expense_date) = 'integer' AND expense_date >= ${fromMs} AND expense_date <= ${toMs})
              OR (typeof(expense_date) = 'text' AND expense_date >= ${fromIso} AND expense_date <= ${toIso})
            )
            AND purchase_return_id IS NULL
        `
      : await db.$queryRaw<{ total: number | null }[]>`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
          WHERE branch_id = ${branchId}
            AND (
              (typeof(expense_date) = 'integer' AND expense_date >= ${fromMs} AND expense_date <= ${toMs})
              OR (typeof(expense_date) = 'text' AND expense_date >= ${fromIso} AND expense_date <= ${toIso})
            )
        `;
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}
