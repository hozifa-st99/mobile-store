/** متوسط مرجّح لتكلفة المخzون (إكسسوارات وأصناف غير الموبايلات) */
export function computeWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  if (incomingQty <= 0) {
    return Math.round(Math.max(0, currentAvgCost) * 100) / 100;
  }
  if (currentQty <= 0) {
    return Math.round(Math.max(0, incomingUnitCost) * 100) / 100;
  }

  const totalValue = currentQty * currentAvgCost + incomingQty * incomingUnitCost;
  const totalQty = currentQty + incomingQty;
  return Math.round((totalValue / totalQty) * 100) / 100;
}

/**
 * متوسط المخزون بعد مرتجع مشتريات + توزيع مصروف على الباقي.
 * الكمية هنا قبل خصم المرتجع. سعر المرتجع = سعر دفعة الفاتورة (بعد مصروفها السابق).
 */
export function computeWeightedAverageAfterPurchaseReturn(input: {
  quantityBeforeReturn: number;
  currentAverageCost: number;
  returnedQuantity: number;
  returnedUnitCost: number;
  redistributedExpense: number;
}): number {
  const remainingQty = input.quantityBeforeReturn - input.returnedQuantity;
  if (remainingQty <= 0) {
    return Math.round(Math.max(0, input.currentAverageCost) * 100) / 100;
  }

  const stockValue =
    input.quantityBeforeReturn * input.currentAverageCost -
    input.returnedQuantity * input.returnedUnitCost +
    input.redistributedExpense;

  return Math.round(Math.max(0, stockValue / remainingQty) * 100) / 100;
}
