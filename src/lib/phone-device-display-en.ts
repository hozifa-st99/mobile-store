export function taxStatusLabelEn(value: string | null | undefined): string {
  switch (value) {
    case "taxable":
      return "Taxable";
    case "local_warranty":
      return "Local warranty";
    case "exempt":
      return "Exempt";
    case "zero":
    default:
      return "Tax paid (Zero)";
  }
}

export function deviceConditionLabelEn(value: string | null | undefined): string {
  return value === "used" ? "Used" : "New";
}

export function boxConditionLabelEn(value: string | null | undefined): string | null {
  if (value === "excellent") return "Box: excellent";
  if (value === "medium") return "Box: fair";
  if (value === "missing") return "No box";
  return null;
}
