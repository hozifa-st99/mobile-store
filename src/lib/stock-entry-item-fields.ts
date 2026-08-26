import type { Prisma } from "@prisma/client";
import { formatImeisSnapshot } from "@/lib/purchase-return-number";

type Db = Prisma.TransactionClient;

export async function setStockEntryItemImeisSnapshot(
  db: Db,
  itemId: string,
  imeis: string[]
): Promise<void> {
  const snapshot = formatImeisSnapshot(imeis);
  if (!snapshot) return;
  await db.$executeRaw`
    UPDATE stock_entry_items SET imeis_snapshot = ${snapshot} WHERE id = ${itemId}
  `;
}
