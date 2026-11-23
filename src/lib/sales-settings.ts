export interface SalesSettings {
  /** الحالة الافتراضية لمربع «ضريبة» في فاتورة مبيعات جديدة */
  defaultTaxEnabled: boolean;
}

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  defaultTaxEnabled: true,
};

export function normalizeSalesSettings(input: unknown): SalesSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    defaultTaxEnabled:
      typeof raw.defaultTaxEnabled === "boolean"
        ? raw.defaultTaxEnabled
        : DEFAULT_SALES_SETTINGS.defaultTaxEnabled,
  };
}