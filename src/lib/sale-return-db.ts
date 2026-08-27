import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

export interface CreateSaleReturnInput {
  branchId: string;
  saleId: string;
  userId: string | null;
  returnNumber: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  items: {
    saleItemId: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    imei: string | null;
    barcode: string | null;
  }[];
}

export interface CreatedSaleReturn {
  id: string;
  returnNumber: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  items: { id: string; saleItemId: string; quantity: number; total: number }[];
}

export async function readSaleReturnNumbersRaw(
  db: Db,
  branchId: string
): Promise<string[]> {
  try {
    const rows = await db.$queryRaw<{ return_number: string }[]>`
      SELECT return_number FROM sale_returns WHERE branch_id = ${branchId}
    `;
    return rows.map((r) => r.return_number);
  } catch {
    return [];
  }
}

export async function saleReturnNumberExistsRaw(
  db: Db,
  branchId: string,
  returnNumber: string
): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM sale_returns
      WHERE branch_id = ${branchId} AND return_number = ${returnNumber}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function createSaleReturnWithItems(
  db: Db,
  input: CreateSaleReturnInput
): Promise<CreatedSaleReturn> {
  const id = randomUUID();
  const now = new Date();

  await db.$executeRaw`
    INSERT INTO sale_returns (
      id, branch_id, sale_id, user_id, return_number, return_date,
      subtotal, discount, tax_rate, tax_amount, total, notes, created_at, updated_at
    ) VALUES (
      ${id}, ${input.branchId}, ${input.saleId}, ${input.userId}, ${input.returnNumber}, ${now},
      ${input.subtotal}, ${input.discount}, ${input.taxRate}, ${input.taxAmount},
      ${input.total}, ${input.notes}, ${now}, ${now}
    )
  `;

  const createdItems: CreatedSaleReturn["items"] = [];
  for (const line of input.items) {
    const itemId = randomUUID();
    await db.$executeRaw`
      INSERT INTO sale_return_items (
        id, sale_return_id, sale_item_id, product_id,
        description, quantity, unit_price, total, imei, barcode
      ) VALUES (
        ${itemId}, ${id}, ${line.saleItemId}, ${line.productId},
        ${line.description}, ${line.quantity}, ${line.unitPrice}, ${line.total},
        ${line.imei}, ${line.barcode}
      )
    `;
    createdItems.push({
      id: itemId,
      saleItemId: line.saleItemId,
      quantity: line.quantity,
      total: line.total,
    });
  }

  return {
    id,
    returnNumber: input.returnNumber,
    subtotal: input.subtotal,
    discount: input.discount,
    taxRate: input.taxRate,
    taxAmount: input.taxAmount,
    total: input.total,
    items: createdItems,
  };
}
