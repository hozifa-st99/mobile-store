export const TAX_STATUS_OPTIONS = [
  { value: "zero", label: "مدفوع الضريبة (Zero)" },
  { value: "taxable", label: "عليه ضريبة" },
  { value: "local_warranty", label: "ضمان محلي" },
  { value: "exempt", label: "معفي" },
] as const;

export type TaxStatus = (typeof TAX_STATUS_OPTIONS)[number]["value"];

export function parseTaxStatus(value: string | null | undefined): TaxStatus {
  if (TAX_STATUS_OPTIONS.some((option) => option.value === value)) {
    return value as TaxStatus;
  }
  return "zero";
}

export function taxStatusLabel(value: string | null | undefined): string {
  return TAX_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "مدفوع الضريبة (Zero)";
}

export function deviceConditionLabel(value: string | null | undefined): string {
  return value === "used" ? "مستعمل" : "جديد";
}

export function parseDeviceConditionFilter(value: string | null | undefined): "new" | "used" | null {
  if (value === "used") return "used";
  if (value === "new") return "new";
  return null;
}

export function boxConditionLabel(value: string | null | undefined): string | null {
  if (value === "excellent") return "كارتونة بحالة ممتازة";
  if (value === "medium") return "كارتونة بحالة متوسطة";
  if (value === "missing") return "بدون كارتونة";
  return null;
}

export function sourceKindLabel(kind: "purchase" | "stock_entry"): string {
  return kind === "purchase" ? "فاتورة مشتريات" : "رصيد افتتاحي / إدخال بضاعة";
}
