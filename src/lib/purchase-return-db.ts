import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

export interface CreatePurchaseReturnInput {
  branchId: string;
  purchaseId: string;
  userId: string | null;
  returnNumber: string;
  subtotal: number;
  total: number;
  notes: string | null;
  expenseHandling: string | null;
  expenseAmount: number;
  expenseRecoveredAmount: number;
  items: {
    purchaseItemId: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    imeisSnapshot: string | null;
  }[];
}

export interface CreatedPurchaseReturn {
  id: string;
  returnNumber: string;
  subtotal: number;
  total: number;
  items: { id: string; purchaseItemId: string; quantity: number; total: number }[];
}

export async function readReturnNumbersRaw(
  db: Db,
  branchId: string
): Promise<string[]> {
  try {
    const rows = await db.$queryRaw<{ return_number: string }[]>`
      SELECT return_number FROM purchase_returns WHERE branch_id = ${branchId}
    `;
    return rows.map((r) => r.return_number);
  } catch {
    return [];
  }
}

export async function returnNumberExistsRaw(
  db: Db,
  branchId: string,
  returnNumber: string
): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM purchase_returns
      WHERE branch_id = ${branchId} AND return_number = ${returnNumber}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** إنشاء مرتجع عبر SQL — يعمل حتى لو Prisma Client قديم */
export async function createPurchaseReturnWithItems(
  db: Db,
  input: CreatePurchaseReturnInput
): Promise<CreatedPurchaseReturn> {
  const id = randomUUID();
  const now = new Date();

  await db.$executeRaw`
    INSERT INTO purchase_returns (
      id, branch_id, purchase_id, user_id, return_number, return_date,
      subtotal, total, notes, expense_handling, expense_amount,
      expense_recovered_amount, created_at, updated_at
    ) VALUES (
      ${id}, ${input.branchId}, ${input.purchaseId}, ${input.userId}, ${input.returnNumber}, ${now},
      ${input.subtotal}, ${input.total}, ${input.notes},
      ${input.expenseHandling}, ${input.expenseAmount}, ${input.expenseRecoveredAmount},
      ${now}, ${now}
    )
  `;

  const createdItems: CreatedPurchaseReturn["items"] = [];
  for (const line of input.items) {
    const itemId = randomUUID();
    await db.$executeRaw`
      INSERT INTO purchase_return_items (
        id, purchase_return_id, purchase_item_id, product_id,
        description, quantity, unit_price, total, imeis_snapshot
      ) VALUES (
        ${itemId}, ${id}, ${line.purchaseItemId}, ${line.productId},
        ${line.description}, ${line.quantity}, ${line.unitPrice}, ${line.total},
        ${line.imeisSnapshot}
      )
    `;
    createdItems.push({
      id: itemId,
      purchaseItemId: line.purchaseItemId,
      quantity: line.quantity,
      total: line.total,
    });
  }

  return {
    id,
    returnNumber: input.returnNumber,
    subtotal: input.subtotal,
    total: input.total,
    items: createdItems,
  };
}
