import "server-only";

import type { Prisma } from "@prisma/client";

import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import { parseStocktakeSerials } from "@/lib/stocktake-serial-snapshot";

type Tx = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

function addLegacyStocktakeRemovedImeis(
  removed: Set<string>,
  item: {
    variance: number;
    systemQuantity: number;
    imeiSnapshot: string | null;
    serialsSnapshot: string | null;
  }
): void {
  if (parseStocktakeSerials(item.serialsSnapshot).length > 0) return;
  if (item.variance >= 0) return;

  const imeis = parseImeisSnapshot(item.imeiSnapshot);
  if (imeis.length === 1 && item.systemQuantity === 1 && item.variance === -1) {
    removed.add(imeis[0]!);
  }
}

/** IMEIs marked absent in completed stocktakes — do not backfill them again. */
export async function loadStocktakeRemovedImeis(
  tx: Tx,
  branchId: string,
  productId: string
): Promise<Set<string>> {
  const items = await tx.stocktakeItem.findMany({
    where: {
      productId,
      stocktake: { branchId, status: "completed" },
    },
    select: {
      variance: true,
      systemQuantity: true,
      imeiSnapshot: true,
      serialsSnapshot: true,
    },
  });

  const removed = new Set<string>();
  for (const item of items) {
    for (const snap of parseStocktakeSerials(item.serialsSnapshot)) {
      if (snap.present) continue;
      for (const imei of snap.imeis) removed.add(imei);
    }
    addLegacyStocktakeRemovedImeis(removed, item);
  }
  return removed;
}

export function isDeviceRemovedByStocktake(
  removedImeis: Set<string>,
  deviceImeis: string[]
): boolean {
  return deviceImeis.some((imei) => removedImeis.has(imei));
}
