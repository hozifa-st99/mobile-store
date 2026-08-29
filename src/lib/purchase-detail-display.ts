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
  returnedQuantity?: number | null;
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

function remainingLineQuantity(item: SavedPurchaseItem): number {
  const returned = Math.max(0, item.returnedQuantity ?? 0);
  return Math.max(0, item.quantity - returned);
}

export function purchaseHasPostReturnPicture(
  items: SavedPurchaseItem[],
  returnCount: number
): boolean {
  if (returnCount > 0) return true;
  return items.some((item) => {
    const remaining = remainingLineQuantity(item);
    if (remaining < item.quantity) return true;
    const effective = item.effectiveUnitPrice ?? item.unitPrice;
    return Math.abs(effective - item.unitPrice) > 0.001;
  });
}

/** الحالة الأخيرة بعد المرتجعات وتوزيع المصروف — عرض فقط */
export function buildLatestPurchaseItemRows(
  items: SavedPurchaseItem[],
  options?: { showExpenseBreakdown?: boolean; returnedImeis?: string[] }
): InvoiceLineRow[] {
  const showBreakdown = options?.showExpenseBreakdown ?? true;
  const returnedImeiSet = new Set(
    (options?.returnedImeis ?? []).map((imei) => imei.trim()).filter(Boolean)
  );

  return items
    .map((item) => {
      const remainingQty = remainingLineQuantity(item);
      if (remainingQty <= 0) return null;

      const originalImeis = parseImeisSnapshot(item.imeisSnapshot);
      const remainingImeis =
        originalImeis.length > 0
          ? originalImeis.filter((imei) => !returnedImeiSet.has(imei))
          : originalImeis;
      const isPhone = remainingImeis.length > 0 || originalImeis.length > 0;

      const invoiceAfter = item.unitPrice;
      const latestAfter = item.effectiveUnitPrice ?? invoiceAfter;
      const hasInvoiceExpense = showBreakdown && lineHasInvoiceExpense(item);
      const hasReturnRedistribute = Math.abs(latestAfter - invoiceAfter) > 0.001;
      const showAfter = hasInvoiceExpense || hasReturnRedistribute;
      const before = hasInvoiceExpense ? item.unitPriceBefore! : invoiceAfter;

      const name = item.description.split(" · ")[0]?.trim() || item.description;
      const detailsParts = item.description.split(" · ").slice(1);
      const extraDetails = [
        ...detailsParts,
        item.barcode ? `باركود: ${item.barcode}` : null,
        isPhone && remainingImeis.length > 0 ? `IMEI: ${remainingImeis.join(" / ")}` : null,
        remainingQty < item.quantity
          ? `متبقي ${remainingQty} من ${item.quantity}`
          : null,
        item.itemNotes?.trim() || null,
      ].filter(Boolean);

      return {
        id: `${item.id}-latest`,
        type: (isPhone ? "phone" : "accessory") as InvoiceLineRow["type"],
        typeLabel: isPhone ? "موبايل" : "صنف",
        name,
        details: extraDetails.join(" · ") || "—",
        quantity: remainingQty,
        unitPrice: before,
        unitPriceAfter: showAfter ? latestAfter : undefined,
        expenseShare: showAfter ? (latestAfter - before) * remainingQty : undefined,
        retailPrice: item.retailPrice,
        total: before * remainingQty,
        totalAfter: showAfter ? latestAfter * remainingQty : undefined,
        barcode: item.barcode || "—",
        imeis: isPhone ? remainingImeis : [],
        condition: conditionLabel(item),
      };
    })
    .filter((row): row is InvoiceLineRow => row != null);
}

export function latestTableShowsExpenseColumns(rows: InvoiceLineRow[]): boolean {
  return rows.some((row) => row.unitPriceAfter != null);
}
