import type { InvoiceLineRow } from "@/lib/purchase-line-display";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";

export interface SavedPurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitPriceBefore?: number | null;
  /** السعر الفعلي بعد المصروف + توزيعات المرتجعات */
  effectiveUnitPrice?: number | null;
  retailPrice: number;
  total: number;
  barcode?: string | null;
  imeisSnapshot?: string | null;
  deviceCondition: string;
  boxCondition?: string | null;
  batteryPercent?: number | null;
  itemNotes?: string | null;
}

function conditionLabel(item: SavedPurchaseItem): string {
  if (item.deviceCondition === "used") {
    const parts = ["مستعمل"];
    if (item.batteryPercent != null) parts.push(`بطارية ${item.batteryPercent}%`);
    if (item.boxCondition === "excellent") parts.push("كارتونة ممتازة");
    else if (item.boxCondition === "medium") parts.push("كارتونة متوسطة");
    else if (item.boxCondition === "missing") parts.push("بدون كارتونة");
    return parts.join(" · ");
  }
  return "جديد";
}

export function purchaseItemsHaveExpenses(items: SavedPurchaseItem[]): boolean {
  return items.some((item) => {
    const before = item.unitPriceBefore ?? item.unitPrice;
    const after = item.effectiveUnitPrice ?? item.unitPrice;
    return Math.abs(before - after) > 0.001;
  });
}

export function buildSavedPurchaseItemRows(items: SavedPurchaseItem[]): InvoiceLineRow[] {
  return items.map((item) => {
    const before = item.unitPriceBefore ?? item.unitPrice;
    const after = item.effectiveUnitPrice ?? item.unitPrice;
    const hasExpenseLine = Math.abs(before - after) > 0.001;

    const imeis = parseImeisSnapshot(item.imeisSnapshot);
    const isPhone = imeis.length > 0;

    const name = item.description.split(" · ")[0]?.trim() || item.description;
    const detailsParts = item.description.split(" · ").slice(1);
    const extraDetails = [
      ...detailsParts,
      item.barcode ? `باركود: ${item.barcode}` : null,
      isPhone ? `IMEI: ${imeis.join(" / ")}` : null,
      item.itemNotes?.trim() || null,
    ].filter(Boolean);

    return {
      id: item.id,
      type: isPhone ? "phone" : "accessory",
      typeLabel: isPhone ? "موبايل" : "صنف",
      name,
      details: extraDetails.join(" · ") || "—",
      quantity: item.quantity,
      unitPrice: before,
      unitPriceAfter: hasExpenseLine ? after : undefined,
      expenseShare: hasExpenseLine ? (after - before) * item.quantity : undefined,
      retailPrice: item.retailPrice,
      total: before * item.quantity,
      totalAfter: hasExpenseLine ? after * item.quantity : undefined,
      barcode: item.barcode || "—",
      imeis: isPhone ? imeis : [],
      condition: conditionLabel(item),
    };
  });
}

export function sumPurchaseItemsBefore(items: SavedPurchaseItem[]): number {
  return items.reduce(
    (s, item) => s + (item.unitPriceBefore ?? item.unitPrice) * item.quantity,
    0
  );
}

export function sumPurchaseItemsAfter(items: SavedPurchaseItem[]): number {
  return items.reduce(
    (s, item) => s + (item.effectiveUnitPrice ?? item.unitPrice) * item.quantity,
    0
  );
}
