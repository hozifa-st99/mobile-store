export function taxStatusLabel(value: string | null | undefined): string {
  if (value === "taxable") return "عليه ضريبة";
  return "مدفوع الضريبة (Zero)";
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
