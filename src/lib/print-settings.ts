export const PRINT_PAPER_SIZES = [
  { value: "58", label: "حراري 58 مم", kind: "thermal" as const, widthMm: 58 },
  { value: "70", label: "حراري 70 مم", kind: "thermal" as const, widthMm: 70 },
  { value: "72", label: "حراري 72 مم", kind: "thermal" as const, widthMm: 72 },
  { value: "75", label: "حراري 75 مم", kind: "thermal" as const, widthMm: 75 },
  { value: "80", label: "حراري 80 مم", kind: "thermal" as const, widthMm: 80 },
  { value: "a4", label: "A4", kind: "sheet" as const, pageSize: "A4" as const },
  { value: "b5", label: "B5", kind: "sheet" as const, pageSize: "B5" as const },
] as const;

export const THERMAL_PAPER_SIZES = PRINT_PAPER_SIZES.filter((size) => size.kind === "thermal");
export const SHEET_PAPER_SIZES = PRINT_PAPER_SIZES.filter((size) => size.kind === "sheet");

export type PrintPaperSize = (typeof PRINT_PAPER_SIZES)[number]["value"];

export interface PrintSettings {
  paperSize: PrintPaperSize;
  headerTitle: string;
  headerSubtitle: string;
  footerText: string;
  /** حجم الخط الأساسي للفواتير الحرارية (بكسل) */
  thermalFontSize: number;
  /** حجم الخط الأساسي لفواتير A4 و B5 (بكسل) */
  sheetFontSize: number;
  /** عدد النسخ المطبوعة تلقائياً بعد حفظ فاتورة البيع (0 = بدون طباعة) */
  autoPrintCopies: number;
  /** لون هيدر جدول الأصناف — A4 / B5 */
  sheetTableHeaderColor: string;
  /** لون هيدر جدول الأصناف — حراري */
  thermalTableHeaderColor: string;
  /** سمك إطار الجدول الخارجي (بكسل) */
  tableBorderWidth: number;
  /** إظهار هاتف الفرع على فاتورة A4 / B5 */
  showBranchPhoneOnInvoice: boolean;
  /** إظهار عنوان الفرع على فاتورة A4 / B5 */
  showBranchAddressOnInvoice: boolean;
  /** إظهار رقم الفاتورة في بيانات الإيصال */
  showInvoiceNumberOnInvoice: boolean;
  /** إظهار اسم حساب من أنشأ الفاتورة */
  showInvoiceCreatorOnInvoice: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: "80",
  headerTitle: "",
  headerSubtitle: "فاتورة مبيعات",
  footerText: "شكراً لتعاملكم معنا",
  thermalFontSize: 11,
  sheetFontSize: 13,
  autoPrintCopies: 0,
  sheetTableHeaderColor: "#6d28d9",
  thermalTableHeaderColor: "#000000",
  tableBorderWidth: 2,
  showBranchPhoneOnInvoice: true,
  showBranchAddressOnInvoice: true,
  showInvoiceNumberOnInvoice: true,
  showInvoiceCreatorOnInvoice: true,
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const hex = trimmed.slice(1);
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return fallback;
}

export function getInvoiceTableStyleVars(
  settings: PrintSettings,
  isThermal: boolean
): Record<string, string> {
  const borderWidth = settings.tableBorderWidth;
  const cellBorderWidth = Math.max(1, borderWidth - 1);

  return {
    "--invoice-table-header-bg": isThermal
      ? settings.thermalTableHeaderColor
      : settings.sheetTableHeaderColor,
    "--invoice-table-border-width": `${borderWidth}px`,
    "--invoice-table-cell-border-width": `${cellBorderWidth}px`,
    "--invoice-table-border-color": "#000000",
  };
}

export function normalizePrintSettings(
  input: Partial<PrintSettings> | null | undefined
): PrintSettings {
  const paperSize = PRINT_PAPER_SIZES.some((size) => size.value === input?.paperSize)
    ? (input!.paperSize as PrintPaperSize)
    : DEFAULT_PRINT_SETTINGS.paperSize;

  return {
    paperSize,
    headerTitle: typeof input?.headerTitle === "string" ? input.headerTitle : "",
    headerSubtitle:
      typeof input?.headerSubtitle === "string" && input.headerSubtitle.trim()
        ? input.headerSubtitle
        : DEFAULT_PRINT_SETTINGS.headerSubtitle,
    footerText:
      typeof input?.footerText === "string" && input.footerText.trim()
        ? input.footerText
        : DEFAULT_PRINT_SETTINGS.footerText,
    thermalFontSize: clampInt(
      input?.thermalFontSize,
      DEFAULT_PRINT_SETTINGS.thermalFontSize,
      8,
      16
    ),
    sheetFontSize: clampInt(
      input?.sheetFontSize,
      DEFAULT_PRINT_SETTINGS.sheetFontSize,
      10,
      20
    ),
    autoPrintCopies: clampInt(
      input?.autoPrintCopies,
      DEFAULT_PRINT_SETTINGS.autoPrintCopies,
      0,
      10
    ),
    sheetTableHeaderColor: normalizeHexColor(
      input?.sheetTableHeaderColor,
      DEFAULT_PRINT_SETTINGS.sheetTableHeaderColor
    ),
    thermalTableHeaderColor: normalizeHexColor(
      input?.thermalTableHeaderColor,
      DEFAULT_PRINT_SETTINGS.thermalTableHeaderColor
    ),
    tableBorderWidth: clampInt(
      input?.tableBorderWidth,
      DEFAULT_PRINT_SETTINGS.tableBorderWidth,
      1,
      5
    ),
    showBranchPhoneOnInvoice:
      typeof input?.showBranchPhoneOnInvoice === "boolean"
        ? input.showBranchPhoneOnInvoice
        : DEFAULT_PRINT_SETTINGS.showBranchPhoneOnInvoice,
    showBranchAddressOnInvoice:
      typeof input?.showBranchAddressOnInvoice === "boolean"
        ? input.showBranchAddressOnInvoice
        : DEFAULT_PRINT_SETTINGS.showBranchAddressOnInvoice,
    showInvoiceNumberOnInvoice:
      typeof input?.showInvoiceNumberOnInvoice === "boolean"
        ? input.showInvoiceNumberOnInvoice
        : DEFAULT_PRINT_SETTINGS.showInvoiceNumberOnInvoice,
    showInvoiceCreatorOnInvoice:
      typeof input?.showInvoiceCreatorOnInvoice === "boolean"
        ? input.showInvoiceCreatorOnInvoice
        : DEFAULT_PRINT_SETTINGS.showInvoiceCreatorOnInvoice,
  };
}

export function getPaperSizeMeta(paperSize: PrintPaperSize) {
  return PRINT_PAPER_SIZES.find((size) => size.value === paperSize) ?? PRINT_PAPER_SIZES[4];
}

export interface SaleInvoicePrintItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imei?: string | null;
  barcode?: string | null;
}

export interface SaleInvoicePrintData {
  invoiceNumber: string;
  saleDate: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  notes?: string | null;
  customer?: { nameAr: string; phone?: string | null } | null;
  items: SaleInvoicePrintItem[];
}

export interface SaleInvoicePrintContext {
  companyName: string;
  branchName?: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  /** اسم الحساب (الاسم العربي) الذي أنشأ الفاتورة */
  invoiceCreatorName?: string | null;
}

export const SAMPLE_SALE_INVOICE: SaleInvoicePrintData = {
  invoiceNumber: "SAL-MAD-00000001",
  saleDate: new Date().toISOString(),
  paymentMethod: "cash",
  subtotal: 1500,
  discount: 100,
  taxRate: 14,
  taxAmount: 196,
  total: 1596,
  paidAmount: 1596,
  notes: null,
  customer: { nameAr: "محمد أحمد", phone: "01012345678" },
  items: [
    {
      description: "سماعة بلوتوث",
      quantity: 2,
      unitPrice: 500,
      total: 1000,
    },
    {
      description: "جراب موبايل",
      quantity: 1,
      unitPrice: 500,
      total: 500,
    },
  ],
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};
