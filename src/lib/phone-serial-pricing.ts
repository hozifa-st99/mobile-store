import { formatAmountExact } from "@/lib/utils";

export interface SerialPriceInput {
  unitCost: number;
  retailPrice: number;
  purchaseItemRetailPrice?: number | null;
  stockEntryItemRetailPrice?: number | null;
  inventoryRetailPrice?: number;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Effective retail for a phone serial (override → purchase line → stock entry → inventory). */
export function getSerialEffectiveRetailPrice(
  serial: SerialPriceInput,
  inventoryRetailPrice = 0
): number {
  if (serial.retailPrice > 0.001) return roundMoney(serial.retailPrice);
  if (serial.purchaseItemRetailPrice != null && serial.purchaseItemRetailPrice > 0.001) {
    return roundMoney(serial.purchaseItemRetailPrice);
  }
  if (serial.stockEntryItemRetailPrice != null && serial.stockEntryItemRetailPrice > 0.001) {
    return roundMoney(serial.stockEntryItemRetailPrice);
  }
  if (serial.inventoryRetailPrice != null && serial.inventoryRetailPrice > 0.001) {
    return roundMoney(serial.inventoryRetailPrice);
  }
  return roundMoney(inventoryRetailPrice);
}

export function getSerialEffectivePurchasePrice(serial: { unitCost: number }) {
  return roundMoney(serial.unitCost);
}

export interface PriceRangeSummary {
  min: number;
  max: number;
  single: boolean;
  display: string;
}

export function summarizePriceRange(values: number[]): PriceRangeSummary | null {
  const filtered = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (filtered.length === 0) return null;

  const min = roundMoney(Math.min(...filtered));
  const max = roundMoney(Math.max(...filtered));
  const single = Math.abs(min - max) < 0.001;

  return {
    min,
    max,
    single,
    display: single
      ? formatAmountExact(min)
      : `من ${formatAmountExact(min)} : ${formatAmountExact(max)}`,
  };
}

export function formatPriceRangeLabel(range: PriceRangeSummary | null, fallback = "0") {
  if (!range) return fallback;
  return range.display;
}
