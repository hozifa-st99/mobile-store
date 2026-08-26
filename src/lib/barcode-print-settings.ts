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
}

export const DEFAULT_BARCODE_PRINT_SETTINGS: BarcodePrintSettings = {
  labelSize: "38x25",
  showName: true,
  showPrice: true,
};

export interface BarcodeLabelItem {
  barcodeValue: string;
  name?: string;
  price?: number;
}

export const SAMPLE_BARCODE_LABEL: BarcodeLabelItem = {
  barcodeValue: "6281001234567",
  name: "سماعة بلوتوث",
  price: 350,
};

export function getBarcodeLabelMeta(labelSize: BarcodeLabelSize) {
  return BARCODE_LABEL_SIZES.find((size) => size.value === labelSize) ?? BARCODE_LABEL_SIZES[0];
}

export function getBarcodeRenderOptions(labelSize: BarcodeLabelSize) {
  switch (labelSize) {
    case "38x12.5":
      return { height: 10, barWidth: 0.85, fontSize: 6 };
    case "38x25":
      return { height: 24, barWidth: 1, fontSize: 8 };
    case "50x25":
      return { height: 28, barWidth: 1.15, fontSize: 9 };
    case "40x30":
      return { height: 34, barWidth: 1.25, fontSize: 10 };
    case "50x30":
      return { height: 38, barWidth: 1.35, fontSize: 10 };
    default:
      return { height: 28, barWidth: 1.15, fontSize: 9 };
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
  };
}
