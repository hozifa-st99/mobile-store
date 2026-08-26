import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** مبلغ مع كسور لو موجودة (حتى قرشين) — للمصروفات والأسعار الدقيقة */
export function formatAmountExact(amount: number): string {
  const value = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(value - Math.round(value)) > 0.0001;

  return new Intl.NumberFormat("ar-EG", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(value);
}

/** سعر الشراء بعد المصروف — يعرض الكسر لو موجود (الخانة دي فقط) */
export function formatPriceAfterExpense(amount: number): string {
  return formatAmountExact(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("ar-EG").format(num);
}
