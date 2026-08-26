import { parseStocktakeSerials } from "@/lib/stocktake-serial-snapshot";

/** Saved stocktake row — phones use missing serial costs; legacy rows use variance × unitCost. */
export function computeSavedStocktakeItemAdjustmentAmount(item: {
  variance: number;
  unitCost: number;
  serialsSnapshot?: string | null;
}): number {
  const savedSerials = parseStocktakeSerials(item.serialsSnapshot);
  if (savedSerials.length > 0) {
    const missingSerials = savedSerials.filter((serial) => !serial.present);
    if (missingSerials.length > 0) {
      return -missingSerials.reduce((sum, serial) => sum + serial.unitCost, 0);
    }
    return 0;
  }

  return item.variance * item.unitCost;
}

export function sumSavedStocktakeItemAdjustmentAmount(
  items: Array<{
    variance: number;
    unitCost: number;
    serialsSnapshot?: string | null;
  }>
): number {
  return items.reduce((sum, item) => sum + computeSavedStocktakeItemAdjustmentAmount(item), 0);
}
