import { prisma } from "@/lib/prisma";
import { readEffectiveUnitPricesAfter } from "@/lib/purchase-item-cost-adjustments";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import {
  getSerialEffectiveRetailPrice,
  summarizePriceRange,
  type PriceRangeSummary,
} from "@/lib/phone-serial-pricing";
import {
  formatDeviceImeisLabel,
  getDeviceImeis,
  normalizeDeviceImeis,
} from "@/lib/product-serial-imeis";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";
import { serialWithImeisSelect } from "@/lib/product-serial-service";

export type PurchaseHistoryView = "phone_serials" | "purchase_lines";

export interface AccessoryPurchaseLine {
  id: string;
  source: "purchase" | "stock_entry";
  sourceLabel: string;
  date: string;
  documentNumber: string;
  detailUrl: string;
  supplierName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  retailPrice: number;
}

export interface PhoneSerialLine {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  cycleIndex: number | null;
  unitPrice: number;
  retailPrice: number;
  status: string;
  statusLabel: string;
  date: string;
  documentNumber: string;
  detailUrl: string;
  supplierName: string | null;
  source: "purchase" | "stock_entry";
  sourceLabel: string;
}

export interface ProductPurchaseHistory {
  productId: string;
  productName: string;
  brand: string;
  productType: string;
  deviceCondition?: string | null;
  view: PurchaseHistoryView;
  currentPurchasePrice: number;
  currentRetailPrice: number;
  purchasePriceRange?: PriceRangeSummary | null;
  retailPriceRange?: PriceRangeSummary | null;
  entryCount: number;
  accessoryLines: AccessoryPurchaseLine[];
  phoneSerials: PhoneSerialLine[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function compareNewestFirst(
  dateA: Date | string,
  createdA: Date | string,
  dateB: Date | string,
  createdB: Date | string
): number {
  const docDiff = new Date(dateB).getTime() - new Date(dateA).getTime();
  if (docDiff !== 0) return docDiff;
  return new Date(createdB).getTime() - new Date(createdA).getTime();
}

function serialStatusLabel(status: string) {
  if (status === "available") return "متاح";
  if (status === "sold") return "مباع";
  if (status === "removed") return "غير موجود";
  return status;
}

function lineRetailPrice(
  retailPrice: number | null | undefined,
  inventoryRetailPrice: number
): number {
  if (retailPrice != null && retailPrice > 0.001) return roundMoney(retailPrice);
  return roundMoney(inventoryRetailPrice);
}

type PhoneSerialLineDraft = PhoneSerialLine & { createdAt: string };

type PhoneDocumentSerial = {
  serialNumber: string | null;
  unitCost: number;
  retailPrice: number;
  status: string;
  cycleIndex: number;
  purchaseItem?: { retailPrice: number } | null;
  stockEntryItem?: { retailPrice: number } | null;
} & Parameters<typeof getDeviceImeis>[0];

/** نفس مصدر IMEI في عرض الحركة: imeisSnapshot على بند المستند */
function pickLineImeis(imeisSnapshot: string | null | undefined): string[] {
  return normalizeDeviceImeis(parseImeisSnapshot(imeisSnapshot));
}

function deriveLineStatus(serials: Array<{ status: string }>): Pick<PhoneSerialLine, "status" | "statusLabel"> {
  if (serials.length === 0) {
    return { status: "removed", statusLabel: serialStatusLabel("removed") };
  }

  const uniqueStatuses = new Set(serials.map((serial) => serial.status));
  if (uniqueStatuses.size === 1) {
    const status = serials[0]!.status;
    return { status, statusLabel: serialStatusLabel(status) };
  }

  if (serials.some((serial) => serial.status === "available")) {
    return { status: "available", statusLabel: serialStatusLabel("available") };
  }

  if (serials.every((serial) => serial.status === "sold")) {
    return { status: "sold", statusLabel: serialStatusLabel("sold") };
  }

  return { status: "removed", statusLabel: serialStatusLabel("removed") };
}

function formatLineSerialNumbers(serials: Array<{ serialNumber: string | null }>): string | null {
  const values = serials
    .map((serial) => serial.serialNumber?.trim())
    .filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join("\n") : null;
}

function mapPhoneDocumentLine(
  id: string,
  item: {
    imeisSnapshot: string | null;
    retailPrice: number;
    serials: PhoneDocumentSerial[];
  },
  documentUnitPrice: number,
  inventoryRetailPrice: number,
  productId: string,
  meta: {
    date: string;
    createdAt: string;
    documentNumber: string;
    detailUrl: string;
    supplierName: string | null;
    source: "purchase" | "stock_entry";
    sourceLabel: string;
  }
): PhoneSerialLineDraft | null {
  const imeis = pickLineImeis(item.imeisSnapshot);
  if (imeis.length === 0) return null;

  const serials = item.serials.filter((serial) => serialBelongsToProduct(serial, productId));
  const { status, statusLabel } = deriveLineStatus(serials);
  const lineRetail = lineRetailPrice(item.retailPrice, inventoryRetailPrice);
  const primarySerial = serials.length === 1 ? serials[0]! : null;

  const unitPrice = roundMoney(
    primarySerial && primarySerial.unitCost > 0.001 ? primarySerial.unitCost : documentUnitPrice
  );
  const retailPrice = primarySerial
    ? getSerialEffectiveRetailPrice(
        {
          unitCost: primarySerial.unitCost,
          retailPrice: primarySerial.retailPrice,
          purchaseItemRetailPrice: primarySerial.purchaseItem?.retailPrice,
          stockEntryItemRetailPrice: primarySerial.stockEntryItem?.retailPrice,
        },
        inventoryRetailPrice
      )
    : lineRetail;

  return {
    id,
    imei: formatDeviceImeisLabel(imeis),
    serialNumber: formatLineSerialNumbers(serials),
    cycleIndex: primarySerial?.cycleIndex ?? serials[0]?.cycleIndex ?? null,
    unitPrice,
    retailPrice,
    status,
    statusLabel,
    date: meta.date,
    createdAt: meta.createdAt,
    documentNumber: meta.documentNumber,
    detailUrl: meta.detailUrl,
    supplierName: meta.supplierName,
    source: meta.source,
    sourceLabel: meta.sourceLabel,
  };
}

async function loadAccessoryLines(
  branchId: string,
  productId: string
): Promise<AccessoryPurchaseLine[]> {
  const [purchaseItems, stockEntryItems] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { branchId, status: "completed" },
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        unitPrice: true,
        retailPrice: true,
        purchase: {
          select: {
            id: true,
            invoiceNumber: true,
            purchaseDate: true,
            createdAt: true,
            supplier: { select: { nameAr: true } },
          },
        },
      },
    }),
    prisma.stockEntryItem.findMany({
      where: {
        productId,
        stockEntry: { branchId, status: "completed" },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        retailPrice: true,
        stockEntry: {
          select: {
            id: true,
            documentNumber: true,
            entryDate: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const effectivePrices = await readEffectiveUnitPricesAfter(
    prisma,
    purchaseItems.map((item) => ({
      id: item.id,
      unitPrice: item.unitPrice,
      productId: item.productId,
    })),
    branchId
  );

  const lines: (AccessoryPurchaseLine & { createdAt: string })[] = [];

  for (const item of purchaseItems) {
    const unitPrice = effectivePrices[item.id] ?? item.unitPrice;
    lines.push({
      id: `purchase-${item.id}`,
      source: "purchase",
      sourceLabel: "فاتورة مشتريات",
      date: item.purchase.purchaseDate.toISOString(),
      createdAt: item.purchase.createdAt.toISOString(),
      documentNumber: item.purchase.invoiceNumber,
      detailUrl: `/dashboard/purchases/${item.purchase.id}`,
      supplierName: item.purchase.supplier.nameAr,
      unitPrice: roundMoney(unitPrice),
      quantity: item.quantity,
      lineTotal: roundMoney(unitPrice * item.quantity),
      retailPrice: roundMoney(item.retailPrice),
    });
  }

  for (const item of stockEntryItems) {
    lines.push({
      id: `stock-entry-${item.id}`,
      source: "stock_entry",
      sourceLabel: "إدخال رصيد",
      date: item.stockEntry.entryDate.toISOString(),
      createdAt: item.stockEntry.createdAt.toISOString(),
      documentNumber: item.stockEntry.documentNumber,
      detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
      supplierName: null,
      unitPrice: roundMoney(item.unitPrice),
      quantity: item.quantity,
      lineTotal: roundMoney(item.unitPrice * item.quantity),
      retailPrice: roundMoney(item.retailPrice),
    });
  }

  lines.sort((a, b) => compareNewestFirst(a.date, a.createdAt, b.date, b.createdAt));

  return lines.map(({ createdAt: _createdAt, ...line }) => line);
}

async function loadPhoneSerials(
  branchId: string,
  productId: string,
  inventoryRetailPrice: number
): Promise<PhoneSerialLine[]> {
  const [purchaseItems, stockEntryItems] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { branchId, status: "completed" },
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        unitPrice: true,
        retailPrice: true,
        imeisSnapshot: true,
        purchase: {
          select: {
            id: true,
            invoiceNumber: true,
            purchaseDate: true,
            createdAt: true,
            supplier: { select: { nameAr: true } },
          },
        },
        serials: {
          where: { branchId, productId },
          select: {
            ...serialWithImeisSelect,
            serialNumber: true,
            purchaseItem: { select: { retailPrice: true } },
            stockEntryItem: { select: { retailPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.stockEntryItem.findMany({
      where: {
        productId,
        stockEntry: { branchId, status: "completed" },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        retailPrice: true,
        imeisSnapshot: true,
        stockEntry: {
          select: {
            id: true,
            documentNumber: true,
            entryDate: true,
            createdAt: true,
          },
        },
        serials: {
          where: { branchId, productId },
          select: {
            ...serialWithImeisSelect,
            serialNumber: true,
            purchaseItem: { select: { retailPrice: true } },
            stockEntryItem: { select: { retailPrice: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  const effectivePrices = await readEffectiveUnitPricesAfter(
    prisma,
    purchaseItems.map((item) => ({
      id: item.id,
      unitPrice: item.unitPrice,
      productId: item.productId,
    })),
    branchId
  );

  const lines: PhoneSerialLineDraft[] = [];

  for (const item of purchaseItems) {
    const purchase = item.purchase;
    const unitPrice = effectivePrices[item.id] ?? item.unitPrice;
    const row = mapPhoneDocumentLine(
      `purchase-${item.id}`,
      item,
      unitPrice,
      inventoryRetailPrice,
      productId,
      {
        date: purchase.purchaseDate.toISOString(),
        createdAt: purchase.createdAt.toISOString(),
        documentNumber: purchase.invoiceNumber,
        detailUrl: `/dashboard/purchases/${purchase.id}`,
        supplierName: purchase.supplier.nameAr,
        source: "purchase",
        sourceLabel: "فاتورة مشتريات",
      }
    );
    if (row) lines.push(row);
  }

  for (const item of stockEntryItems) {
    const stockEntry = item.stockEntry;
    const row = mapPhoneDocumentLine(
      `stock-entry-${item.id}`,
      item,
      item.unitPrice,
      inventoryRetailPrice,
      productId,
      {
        date: stockEntry.entryDate.toISOString(),
        createdAt: stockEntry.createdAt.toISOString(),
        documentNumber: stockEntry.documentNumber,
        detailUrl: `/dashboard/stock-entries/${stockEntry.id}`,
        supplierName: null,
        source: "stock_entry",
        sourceLabel: "إدخال رصيد",
      }
    );
    if (row) lines.push(row);
  }

  lines.sort((a, b) => compareNewestFirst(a.date, a.createdAt, b.date, b.createdAt));

  return lines.map(({ createdAt: _createdAt, ...line }) => line);
}

export async function getProductPurchaseHistory(
  branchId: string,
  companyId: string,
  productId: string
): Promise<ProductPurchaseHistory | null> {
  const inventory = await prisma.branchInventory.findUnique({
    where: {
      branchId_productId: { branchId, productId },
    },
    include: {
      product: {
        select: {
          id: true,
          nameAr: true,
          brand: true,
          type: true,
          deviceCondition: true,
          companyId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!inventory?.product || inventory.product.companyId !== companyId || inventory.product.deletedAt) {
    return null;
  }

  const isPhone = inventory.product.type === "phone";
  const accessoryLines = isPhone ? [] : await loadAccessoryLines(branchId, productId);
  const phoneSerials = isPhone
    ? await loadPhoneSerials(branchId, productId, inventory.retailPrice)
    : [];

  let currentPurchasePrice = roundMoney(inventory.purchasePrice);
  let currentRetailPrice = roundMoney(inventory.retailPrice);
  let purchasePriceRange: PriceRangeSummary | null = null;
  let retailPriceRange: PriceRangeSummary | null = null;

  if (isPhone && phoneSerials.length > 0) {
    const pricedSerials = phoneSerials.filter((serial) => serial.status === "available");
    const source = pricedSerials.length > 0 ? pricedSerials : phoneSerials;

    purchasePriceRange = summarizePriceRange(source.map((serial) => serial.unitPrice));
    retailPriceRange = summarizePriceRange(source.map((serial) => serial.retailPrice));

    if (purchasePriceRange?.single) currentPurchasePrice = purchasePriceRange.min;
    if (retailPriceRange?.single) currentRetailPrice = retailPriceRange.min;
  }

  return {
    productId: inventory.product.id,
    productName: inventory.product.nameAr,
    brand: inventory.product.brand,
    productType: inventory.product.type,
    deviceCondition: inventory.product.deviceCondition,
    view: isPhone ? "phone_serials" : "purchase_lines",
    currentPurchasePrice,
    currentRetailPrice,
    purchasePriceRange,
    retailPriceRange,
    entryCount: isPhone ? phoneSerials.length : accessoryLines.length,
    accessoryLines,
    phoneSerials,
  };
}
