import { taxStatusLabel } from "@/lib/phone-device-display";

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
  showTaxStatus: boolean;
  showBattery: boolean;
}

export const DEFAULT_BARCODE_PRINT_SETTINGS: BarcodePrintSettings = {
  labelSize: "38x25",
  showName: true,
  showPrice: true,
  showStorage: false,
  showColor: false,
  showTaxStatus: false,
  showBattery: false,
};

export interface BarcodeLabelItem {
  barcodeValue: string;
  name?: string;
  price?: number;
  /** موبايل — تُستخدم مع إعدادات showStorage/showColor/showBattery */
  storage?: string | null;
  color?: string | null;
  taxStatus?: string | null;
  batteryPercent?: number | null;
}

export const SAMPLE_BARCODE_LABEL: BarcodeLabelItem = {
  barcodeValue: "6281001234567",
  name: "iPhone 13",
  price: 18500,
  storage: "128GB",
  color: "أسود",
  taxStatus: "zero",
  batteryPercent: 87,
};

export interface BarcodePhoneMetaLines {
  primary: string | null;
  tax: string | null;
}

/** سطر 1: مساحة · لون · بطارية — سطر 2: الضريبة */
export function formatBarcodePhoneMetaLines(
  settings: BarcodePrintSettings,
  label: BarcodeLabelItem
): BarcodePhoneMetaLines {
  const primaryParts: string[] = [];
  if (settings.showStorage && label.storage?.trim()) primaryParts.push(label.storage.trim());
  if (settings.showColor && label.color?.trim()) primaryParts.push(label.color.trim());
  if (settings.showBattery && label.batteryPercent != null) {
    primaryParts.push(`${label.batteryPercent}%`);
  }

  const tax =
    settings.showTaxStatus && label.taxStatus ? taxStatusLabel(label.taxStatus) : null;

  return {
    primary: primaryParts.length > 0 ? primaryParts.join(" · ") : null,
    tax,
  };
}

export function getBarcodeLabelMeta(labelSize: BarcodeLabelSize) {
  return BARCODE_LABEL_SIZES.find((size) => size.value === labelSize) ?? BARCODE_LABEL_SIZES[0];
}

/** هامش غير قابل للطباعة على أغلب طابعات الملصقات (مم من كل جانب) */
export const BARCODE_LABEL_PRINT_MARGIN_MM = {
  vertical: 1,
  horizontal: 2.5,
} as const;

/** هامش بسيط داخل الملصق (مم من كل جانب) */
export const BARCODE_LABEL_SIDE_INSET_MM = 1.5;

/** فراغ أبيض يمين/يسار الشريط عن حافة الملصق (مم) */
export const BARCODE_GRAPHIC_SIDE_GAP_MM = 5;

/** أدنى سُمك شريط CODE128 — لا ننزل تحته في ملصقات الطباعة */
export const BARCODE_MIN_MODULE_WIDTH = 0.68;

const MM_TO_CSS_PX = 96 / 25.4;

function estimateCode128WidthPx(value: string, barModuleWidth: number, quietPx: number): number {
  const modules = 35 + value.length * 11;
  return modules * barModuleWidth + quietPx * 2;
}

function shrinkBarWidthToFit(
  value: string,
  usableWidthMm: number,
  startBarWidth: number,
  quietPx: number
): number {
  const maxPx = Math.max(24, usableWidthMm * MM_TO_CSS_PX);
  let bar = startBarWidth;
  while (bar > BARCODE_MIN_MODULE_WIDTH && estimateCode128WidthPx(value, bar, quietPx) > maxPx) {
    bar -= 0.03;
  }
  return Math.round(Math.max(BARCODE_MIN_MODULE_WIDTH, bar) * 100) / 100;
}

function growBarWidthToFill(
  value: string,
  targetWidthMm: number,
  startBarWidth: number,
  quietPx: number,
  maxModuleWidth: number
): number {
  const targetPx = Math.max(24, targetWidthMm * MM_TO_CSS_PX);
  let bar = startBarWidth;
  while (bar + 0.02 <= maxModuleWidth && estimateCode128WidthPx(value, bar + 0.02, quietPx) <= targetPx) {
    bar += 0.02;
  }
  return Math.round(bar * 100) / 100;
}

/** عرض عمود المحتوى (اسم + باركود + موبايل) — محاذاة واحدة */
export function getBarcodeLabelContentWidthMm(labelSize: BarcodeLabelSize): number {
  const meta = getBarcodeLabelMeta(labelSize);
  return Math.max(12, meta.widthMm - BARCODE_LABEL_SIDE_INSET_MM * 2);
}

export function getBarcodeUsableWidthMm(labelSize: BarcodeLabelSize): number {
  return getBarcodeLabelContentWidthMm(labelSize);
}

/** عرض الشريط = عرض الملصق − 5 مم من كل جانب */
export function getBarcodeGraphicMaxWidthMm(labelSize: BarcodeLabelSize): number {
  const meta = getBarcodeLabelMeta(labelSize);
  return Math.max(10, meta.widthMm - BARCODE_GRAPHIC_SIDE_GAP_MM * 2);
}

export function getBarcodeRenderOptions(labelSize: BarcodeLabelSize, barcodeValue?: string) {
  const contentMm = getBarcodeLabelContentWidthMm(labelSize);
  const graphicMm = getBarcodeGraphicMaxWidthMm(labelSize);
  const quietPx = 8;

  let height: number;
  let barWidth: number;
  let fontSize: number;

  switch (labelSize) {
    case "38x12.5":
      height = 7;
      barWidth = 0.68;
      fontSize = 5;
      break;
    case "38x25":
      height = 17;
      barWidth = 0.72;
      fontSize = 6;
      break;
    case "50x25":
      height = 20;
      barWidth = 0.8;
      fontSize = 7;
      break;
    case "40x30":
      height = 28;
      barWidth = 0.85;
      fontSize = 9;
      break;
    case "50x30":
      height = 32;
      barWidth = 0.88;
      fontSize = 9;
      break;
    default:
      height = 24;
      barWidth = 0.78;
      fontSize = 8;
  }

  if (barcodeValue?.trim()) {
    const code = barcodeValue.trim();
    const shrunk = shrinkBarWidthToFit(code, graphicMm, barWidth, quietPx);
    barWidth = Math.max(BARCODE_MIN_MODULE_WIDTH, shrunk);
    barWidth = growBarWidthToFill(code, graphicMm, barWidth, quietPx, 2);
  }

  return { height, barWidth, fontSize, quietMargin: quietPx, maxWidthMm: graphicMm };
}

/** خط الاسم والسعر (pt) حسب مقاس الملصق */
export function getBarcodeHeaderFontPt(labelSize: BarcodeLabelSize): { name: number; price: number } {
  switch (labelSize) {
    case "38x12.5":
      return { name: 4.5, price: 4.5 };
    case "38x25":
      return { name: 5.5, price: 5.5 };
    case "50x25":
      return { name: 6, price: 6 };
    case "40x30":
      return { name: 6.5, price: 6.5 };
    case "50x30":
      return { name: 7, price: 7 };
    default:
      return { name: 6, price: 6 };
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
    showTaxStatus:
      typeof input?.showTaxStatus === "boolean"
        ? input.showTaxStatus
        : DEFAULT_BARCODE_PRINT_SETTINGS.showTaxStatus,
    showBattery:
      typeof input?.showBattery === "boolean"
        ? input.showBattery
        : DEFAULT_BARCODE_PRINT_SETTINGS.showBattery,
  };
}
