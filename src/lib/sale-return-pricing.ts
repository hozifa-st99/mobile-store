/** حساب مبلغ المرتجع مع خصم وضريبة تناسبية من فاتورة البيع الأصلية */

export interface SaleReturnPricingInput {
  saleSubtotal: number;
  saleDiscount: number;
  saleTaxRate: number;
  /** مجموع (الكمية × سعر الوحدة) للأصناف المُرجَعة في هذا المرتجع */
  returnLineSubtotal: number;
}

export interface SaleReturnPricingResult {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeSaleReturnPricing(
  input: SaleReturnPricingInput
): SaleReturnPricingResult {
  const subtotal = round2(Math.max(0, input.returnLineSubtotal));
  const saleSubtotal = Math.max(0, input.saleSubtotal);

  let discount = 0;
  if (saleSubtotal > 0 && input.saleDiscount > 0) {
    discount = round2(input.saleDiscount * (subtotal / saleSubtotal));
  }

  const taxableBase = round2(Math.max(0, subtotal - discount));
  const taxRate = input.saleTaxRate > 0 ? input.saleTaxRate : 0;
  const taxAmount = taxRate > 0 ? round2((taxableBase * taxRate) / 100) : 0;
  const total = round2(taxableBase + taxAmount);

  return { subtotal, discount, taxRate, taxAmount, total };
}
