export const BARCODE_LABEL_SIZES = [
  { value: "38x12.5", label: "3.8 × 1.25 سم", widthMm: 38, heightMm: 12.5 },
  { value: "38x25", label: "3.8 × 2.5 سم", widthMm: 38, heightMm: 25 },
  { value: "50x25", label: "5 × 2.5 سم", widthMm: 50, heightMm: 25 },
  { value: "50x30", label: "5 × 3 سم", widthMm: 50, heightMm: 30 },
  { value: "40x30", label: "4 × 3 سم", widthMm: 40, heightMm: 30 },
] as const;

export type BarcodeLabelSize = (typeof BARCODE_LABEL_SIZES)[number]["value"];

export interface BarcodePrintSettings {
  labelSize: BarcodeLabelSize;
  showName: boolean;
  showPrice: boolean;
  /** موبايل فقط — تحت رقم الباركود */
  showStorage: boolean;
  showColor: boolean;
  showBattery: boolean;
}

export const DEFAULT_BARCODE_PRINT_SETTINGS: BarcodePrintSettings = {
  labelSize: "38x25",
  showName: true,
  showPrice: true,
  showStorage: false,
  showColor: false,
  showBattery: false,
};

export interface BarcodeLabelItem {
  barcodeValue: string;
  name?: string;
  price?: number;
  /** موبايل — تُستخدم مع إعدادات showStorage/showColor/showBattery */
  storage?: string | null;
  color?: string | null;
  batteryPercent?: number | null;
}

export const SAMPLE_BARCODE_LABEL: BarcodeLabelItem = {
  barcodeValue: "6281001234567",
  name: "iPhone 13",
  price: 18500,
  storage: "128GB",
  color: "أسود",
  batteryPercent: 87,
};

export function formatBarcodePhoneMeta(
  settings: BarcodePrintSettings,
  label: BarcodeLabelItem
): string | null {
  const parts: string[] = [];
  if (settings.showStorage && label.storage?.trim()) parts.push(label.storage.trim());
  if (settings.showColor && label.color?.trim()) parts.push(label.color.trim());
  if (settings.showBattery && label.batteryPercent != null) {
    parts.push(`${label.batteryPercent}%`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getBarcodeLabelMeta(labelSize: BarcodeLabelSize) {
  return BARCODE_LABEL_SIZES.find((size) => size.value === labelSize) ?? BARCODE_LABEL_SIZES[0];
}

export function getBarcodeRenderOptions(labelSize: BarcodeLabelSize) {
  switch (labelSize) {
    case "38x12.5":
      return { height: 9, barWidth: 0.78, fontSize: 6 };
    case "38x25":
      return { height: 22, barWidth: 0.92, fontSize: 8 };
    case "50x25":
      return { height: 26, barWidth: 1.05, fontSize: 9 };
    case "40x30":
      return { height: 32, barWidth: 1.15, fontSize: 10 };
    case "50x30":
      return { height: 36, barWidth: 1.22, fontSize: 10 };
    default:
      return { height: 26, barWidth: 1.05, fontSize: 9 };
  }
}

export function normalizeBarcodePrintSettings(
  input: Partial<BarcodePrintSettings> | null | undefined
): BarcodePrintSettings {
  const labelSize = BARCODE_LABEL_SIZES.some((size) => size.value === input?.labelSize)
    ? (input!.labelSize as BarcodeLabelSize)
    : DEFAULT_BARCODE_PRINT_SETTINGS.labelSize;

  return {
    labelSize,
    showName: typeof input?.showName === "boolean" ? input.showName : DEFAULT_BARCODE_PRINT_SETTINGS.showName,
    showPrice:
      typeof input?.showPrice === "boolean" ? input.showPrice : DEFAULT_BARCODE_PRINT_SETTINGS.showPrice,
    showStorage:
      typeof input?.showStorage === "boolean"
        ? input.showStorage
        : DEFAULT_BARCODE_PRINT_SETTINGS.showStorage,
    showColor:
      typeof input?.showColor === "boolean" ? input.showColor : DEFAULT_BARCODE_PRINT_SETTINGS.showColor,
    showBattery:
      typeof input?.showBattery === "boolean"
        ? input.showBattery
        : DEFAULT_BARCODE_PRINT_SETTINGS.showBattery,
  };
}
