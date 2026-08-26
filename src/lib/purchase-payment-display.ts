export const PURCHASE_PAYMENT_TYPE_LABELS: Record<string, string> = {
  full_cash: "دفع كلي",
  credit: "أجل",
  partial_credit: "أجل جزئي",
};

export const CASH_SOURCE_LABELS: Record<string, string> = {
  shift: "الوردية",
  vault: "خزنة الفرع",
};

export function roundPurchaseMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function purchaseOutstanding(total: number, paidAmount: number) {
  return roundPurchaseMoney(Math.max(0, total - paidAmount));
}

export function purchaseSettlementLabel(
  paymentType: string,
  total: number,
  paidAmount: number
): { label: string; tone: "settled" | "partial" | "credit" | "cash" } {
  const outstanding = purchaseOutstanding(total, paidAmount);

  if (paymentType === "full_cash") {
    return { label: "مسدّد (نقدي)", tone: "cash" };
  }
  if (outstanding <= 0.0001) {
    return { label: "مسدّد بالكامل", tone: "settled" };
  }
  if (paymentType === "credit") {
    return { label: `أجل — متبقي ${outstanding}`, tone: "credit" };
  }
  return { label: `جزئي — متبقي ${outstanding}`, tone: "partial" };
}
