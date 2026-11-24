/**
 * تحليل مستقل: خسارة البيع تحت التكلفة (بعد نصيب السطر من خصم الفاتورة).
 * للعرض في التقارير فقط — لا يُستخدم في صافي الربح أو أي مقاييس أخرى.
 */

export type BelowCostSegment = "phone" | "accessory";

export interface BelowCostLineInput {
  quantity: number;
  unitPrice: number;
  unitCost: number;
  saleSubtotal: number;
  saleDiscount: number;
}

export interface BelowCostDetailRow {
  id: string;
  segment: BelowCostSegment;
  description: string;
  quantity: number;
  unitCost: number;
  netRevenue: number;
  lineCost: number;
  loss: number;
  invoiceNumber: string;
  documentDate: string;
  kind: "sale" | "return";
  productId: string | null;
}

export interface BelowCostSegmentSummary {
  segment: BelowCostSegment;
  label: string;
  loss: number;
  lineCount: number;
}

export interface BelowCostReportResult {
  totalLoss: number;
  saleLineCount: number;
  returnLineCount: number;
  segments: BelowCostSegmentSummary[];
  details: BelowCostDetailRow[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** صافي إيراد السطر بعد نصيبه من خصم الفاتورة (بدون ضريبة — كما في تحليل الهامش على مستوى البضاعة). */
export function lineNetRevenueAfterSaleDiscount(input: {
  quantity: number;
  unitPrice: number;
  saleSubtotal: number;
  saleDiscount: number;
}): number {
  const lineSubtotal = round2(Math.max(0, input.quantity) * Math.max(0, input.unitPrice));
  const saleSubtotal = Math.max(0, input.saleSubtotal);
  let discountShare = 0;
  if (saleSubtotal > 0 && input.saleDiscount > 0) {
    discountShare = round2(input.saleDiscount * (lineSubtotal / saleSubtotal));
  }
  return round2(Math.max(0, lineSubtotal - discountShare));
}

/** خسارة السطر إذا كان صافي الإيراد أقل من التكلفة؛ وإلا صفر. */
export function belowCostLineLoss(line: BelowCostLineInput): {
  loss: number;
  netRevenue: number;
  lineCost: number;
} {
  const netRevenue = lineNetRevenueAfterSaleDiscount(line);
  const lineCost = round2(Math.max(0, line.quantity) * Math.max(0, line.unitCost));
  if (netRevenue >= lineCost) {
    return { loss: 0, netRevenue, lineCost };
  }
  return { loss: round2(lineCost - netRevenue), netRevenue, lineCost };
}

function segmentOf(productType: string | null | undefined): BelowCostSegment {
  return productType === "phone" ? "phone" : "accessory";
}

const SEGMENT_LABELS: Record<BelowCostSegment, string> = {
  phone: "موبايلات",
  accessory: "إكسسوارات",
};

type SaleRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  productId: string | null;
  productType: string | null;
  saleSubtotal: number;
  saleDiscount: number;
  invoiceNumber: string;
  saleDate: Date;
};

type ReturnRow = {
  id: string;
  quantity: number;
  saleItem: {
    description: string;
    unitPrice: number;
    unitCost: number;
    productId: string | null;
    productType: string | null;
    saleSubtotal: number;
    saleDiscount: number;
    invoiceNumber: string;
    saleDate: Date;
  };
  returnInvoiceNumber: string;
  returnDate: Date;
};

export function buildBelowCostSalesReport(sales: SaleRow[], returns: ReturnRow[]): BelowCostReportResult {
  const details: BelowCostDetailRow[] = [];
  let saleLineCount = 0;
  let returnLineCount = 0;

  for (const row of sales) {
    const { loss, netRevenue, lineCost } = belowCostLineLoss({
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      unitCost: row.unitCost,
      saleSubtotal: row.saleSubtotal,
      saleDiscount: row.saleDiscount,
    });
    if (loss <= 0) continue;
    saleLineCount += 1;
    const segment = segmentOf(row.productType);
    details.push({
      id: `sale-${row.id}`,
      segment,
      description: row.description,
      quantity: row.quantity,
      unitCost: row.unitCost,
      netRevenue,
      lineCost,
      loss,
      invoiceNumber: row.invoiceNumber,
      documentDate: row.saleDate.toISOString(),
      kind: "sale",
      productId: row.productId,
    });
  }

  for (const row of returns) {
    const si = row.saleItem;
    const { loss, netRevenue, lineCost } = belowCostLineLoss({
      quantity: row.quantity,
      unitPrice: si.unitPrice,
      unitCost: si.unitCost,
      saleSubtotal: si.saleSubtotal,
      saleDiscount: si.saleDiscount,
    });
    if (loss <= 0) continue;
    returnLineCount += 1;
    const segment = segmentOf(si.productType);
    details.push({
      id: `return-${row.id}`,
      segment,
      description: si.description,
      quantity: row.quantity,
      unitCost: si.unitCost,
      netRevenue,
      lineCost,
      loss: -loss,
      invoiceNumber: row.returnInvoiceNumber,
      documentDate: row.returnDate.toISOString(),
      kind: "return",
      productId: si.productId,
    });
  }

  const segmentTotals: Record<BelowCostSegment, { loss: number; lineCount: number }> = {
    phone: { loss: 0, lineCount: 0 },
    accessory: { loss: 0, lineCount: 0 },
  };

  let totalLoss = 0;
  for (const d of details) {
    totalLoss = round2(totalLoss + d.loss);
    segmentTotals[d.segment].loss = round2(segmentTotals[d.segment].loss + d.loss);
    if (d.loss !== 0) {
      segmentTotals[d.segment].lineCount += 1;
    }
  }

  const segments: BelowCostSegmentSummary[] = (["phone", "accessory"] as const).map((segment) => ({
    segment,
    label: SEGMENT_LABELS[segment],
    loss: segmentTotals[segment].loss,
    lineCount: segmentTotals[segment].lineCount,
  }));

  details.sort((a, b) => Math.abs(b.loss) - Math.abs(a.loss));

  return {
    totalLoss,
    saleLineCount,
    returnLineCount,
    segments,
    details,
  };
}