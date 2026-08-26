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
