import type { InvoiceLineRow } from "@/lib/purchase-line-display";
import { roundPurchaseMoney } from "@/lib/purchase-payment-display";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";

export interface PurchaseTotalsForDisplay {
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
}

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

/** مصروف مسجّل على الفاتورة — من unit_price_before فقط، مش من سعر المخزون */
function lineHasInvoiceExpense(item: SavedPurchaseItem): boolean {
  return (
    item.unitPriceBefore != null &&
    Math.abs(item.unitPriceBefore - item.unitPrice) > 0.001
  );
}

export function purchaseItemsHaveExpenses(items: SavedPurchaseItem[]): boolean {
  return items.some(lineHasInvoiceExpense);
}

/** تفصيل المصروف يظهر فقط لو أسعار السطور متطابقة مع الإجمالي المحفوظ */
export function shouldShowInvoiceExpenseBreakdown(
  items: SavedPurchaseItem[],
  purchase: PurchaseTotalsForDisplay
): boolean {
  if (!purchaseItemsHaveExpenses(items)) return false;
  const after = roundPurchaseMoney(sumPurchaseItemsAfter(items));
  const expectedTotal = roundPurchaseMoney(after - purchase.discount + purchase.taxAmount);
  const subtotalOk = Math.abs(after - roundPurchaseMoney(purchase.subtotal)) <= 0.02;
  const totalOk = Math.abs(expectedTotal - roundPurchaseMoney(purchase.total)) <= 0.02;
  return subtotalOk && totalOk;
}

export function buildSavedPurchaseItemRows(
  items: SavedPurchaseItem[],
  options?: { showExpenseBreakdown?: boolean }
): InvoiceLineRow[] {
  const showBreakdown = options?.showExpenseBreakdown ?? true;
  return items.map((item) => {
    const hasExpenseLine = showBreakdown && lineHasInvoiceExpense(item);
    const before = hasExpenseLine ? item.unitPriceBefore! : item.unitPrice;
    const after = item.unitPrice;

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
  return items.reduce((s, item) => s + item.unitPrice * item.quantity, 0);
}
