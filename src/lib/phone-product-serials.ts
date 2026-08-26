import "server-only";

import { prisma } from "@/lib/prisma";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import {
  getSerialEffectivePurchasePrice,
  getSerialEffectiveRetailPrice,
} from "@/lib/phone-serial-pricing";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";
import {
  formatDeviceImeisLabel,
  formatStoredDeviceImeis,
  getDeviceImeis,
  getPrimaryDeviceImei,
  normalizeDeviceImeis,
} from "@/lib/product-serial-imeis";
import {
  assertBranchImeisAvailable,
  createPhoneDeviceSerial,
  serialWithImeisSelect,
  syncPhoneInventoryQuantity,
  type LoadedDeviceSerial,
} from "@/lib/product-serial-service";
import {
  isDeviceRemovedByStocktake,
  loadStocktakeRemovedImeis,
} from "@/lib/stocktake-removed-devices";
import type { ProductInvoiceRow } from "@/lib/retail-price-history-types";

export interface PhoneProductSerialRow {
  id: string;
  imeis: string[];
  imei: string | null;
  barcode: string | null;
  status: string;
  cycleIndex: number;
  purchasePrice: number;
  retailPrice: number;
}

function compareNewestFirst(dateA: Date | string, dateB: Date | string): number {
  return new Date(dateB).getTime() - new Date(dateA).getTime();
}

function invoiceRowKey(row: Pick<ProductInvoiceRow, "type" | "id" | "imei">) {
  return `${row.type}-${row.id}-${row.imei ?? ""}`;
}

/** سعر البيع كما سُجّل على بند الفاتورة — لا يتأثر بتعديل السعر لاحقاً */
function documentLineRetailPrice(retailPrice: number | null | undefined): number | null {
  if (retailPrice == null || retailPrice <= 0.001) return null;
  return Math.round(retailPrice * 100) / 100;
}

interface ProductDeviceLineSource {
  imeis: string[];
  unitPrice: number;
  retailPrice: number;
  barcode: string | null;
  purchaseItemId?: string;
  stockEntryItemId?: string;
}

function mapSerialToPhoneRow(
  serial: LoadedDeviceSerial,
  inventoryRetailPrice: number
): PhoneProductSerialRow {
  const imeis = getDeviceImeis(serial);
  return {
    id: serial.id,
    imeis,
    imei: getPrimaryDeviceImei(serial),
    barcode: serial.barcode,
    status: serial.status,
    cycleIndex: serial.cycleIndex,
    purchasePrice: getSerialEffectivePurchasePrice(serial),
    retailPrice: getSerialEffectiveRetailPrice(
      {
        unitCost: serial.unitCost,
        retailPrice: serial.retailPrice,
        purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
        stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
      },
      inventoryRetailPrice
    ),
  };
}

async function collectProductDeviceLineSources(
  branchId: string,
  productId: string
): Promise<ProductDeviceLineSource[]> {
  const sources: ProductDeviceLineSource[] = [];

  const [purchaseItems, stockEntryItems] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { branchId, status: "completed" },
      },
      select: {
        id: true,
        unitPrice: true,
        retailPrice: true,
        barcode: true,
        imeisSnapshot: true,
        serials: {
          where: { branchId, productId },
          select: { imeiEntries: { select: { imei: true } } },
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
        unitPrice: true,
        retailPrice: true,
        barcode: true,
        imeisSnapshot: true,
        serials: {
          where: { branchId, productId },
          select: { imeiEntries: { select: { imei: true } } },
        },
      },
    }),
  ]);

  for (const item of purchaseItems) {
    const fromSerials = item.serials.flatMap((serial) =>
      getDeviceImeis(serial as LoadedDeviceSerial)
    );
    const imeis = normalizeDeviceImeis([...fromSerials, ...parseImeisSnapshot(item.imeisSnapshot)]);
    if (imeis.length === 0) continue;
    sources.push({
      imeis,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      barcode: item.barcode,
      purchaseItemId: item.id,
    });
  }

  for (const item of stockEntryItems) {
    const fromSerials = item.serials.flatMap((serial) =>
      getDeviceImeis(serial as LoadedDeviceSerial)
    );
    const imeis = normalizeDeviceImeis([...fromSerials, ...parseImeisSnapshot(item.imeisSnapshot)]);
    if (imeis.length === 0) continue;
    sources.push({
      imeis,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      barcode: item.barcode,
      stockEntryItemId: item.id,
    });
  }

  return sources;
}

async function ensurePhoneDeviceRecords(
  branchId: string,
  productId: string,
  sources: ProductDeviceLineSource[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const removedImeis = await loadStocktakeRemovedImeis(tx, branchId, productId);

    for (const source of sources) {
      if (isDeviceRemovedByStocktake(removedImeis, source.imeis)) {
        continue;
      }

      const existing = source.purchaseItemId
        ? await tx.productSerial.findFirst({
            where: { branchId, productId, purchaseItemId: source.purchaseItemId },
            select: { id: true },
          })
        : source.stockEntryItemId
          ? await tx.productSerial.findFirst({
              where: { branchId, productId, stockEntryItemId: source.stockEntryItemId },
              select: { id: true },
            })
          : null;

      if (!existing) {
        await createPhoneDeviceSerial(tx, {
          branchId,
          productId,
          imeis: source.imeis,
          unitCost: source.unitPrice,
          retailPrice: source.retailPrice,
          barcode: source.barcode,
          purchaseItemId: source.purchaseItemId,
          stockEntryItemId: source.stockEntryItemId,
        });
        continue;
      }

      const full = await tx.productSerial.findUnique({
        where: { id: existing.id },
        select: serialWithImeisSelect,
      });
      if (!full) continue;

      const currentImeis = getDeviceImeis(full);
      for (const imei of source.imeis) {
        if (currentImeis.includes(imei)) continue;
        await assertBranchImeisAvailable(tx, branchId, [imei], full.id);
        await tx.productSerialImei.create({
          data: { branchId, serialId: full.id, imei },
        });
      }
    }

    await syncPhoneInventoryQuantity(tx, branchId, productId);
  });
}

export async function loadPhoneProductSerials(
  branchId: string,
  productId: string,
  inventoryRetailPrice: number,
  options?: { availableOnly?: boolean; backfillMissing?: boolean }
): Promise<PhoneProductSerialRow[]> {
  const sources = await collectProductDeviceLineSources(branchId, productId);

  if (options?.backfillMissing !== false) {
    await ensurePhoneDeviceRecords(branchId, productId, sources);
  }

  const serials = await prisma.productSerial.findMany({
    where: {
      branchId,
      productId,
      ...(options?.availableOnly ? { status: "available" } : {}),
    },
    select: serialWithImeisSelect,
    orderBy: { createdAt: "asc" },
  });

  return serials
    .filter((serial) => serialBelongsToProduct(serial, productId))
    .map((serial) => mapSerialToPhoneRow(serial, inventoryRetailPrice))
    .sort((a, b) => (a.imei ?? "").localeCompare(b.imei ?? "", "ar"));
}

export async function loadPhoneProductInvoiceRows(
  branchId: string,
  productId: string
): Promise<ProductInvoiceRow[]> {
  const invoiceMap = new Map<string, ProductInvoiceRow>();

  const addRow = (row: ProductInvoiceRow) => {
    invoiceMap.set(invoiceRowKey(row), row);
  };

  const purchaseItems = await prisma.purchaseItem.findMany({
    where: {
      productId,
      purchase: { branchId, status: "completed" },
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      retailPrice: true,
      imeisSnapshot: true,
      purchase: {
        select: {
          id: true,
          invoiceNumber: true,
          purchaseDate: true,
          supplier: { select: { nameAr: true } },
        },
      },
      serials: {
        where: { branchId, productId },
        select: serialWithImeisSelect,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { purchase: { purchaseDate: "desc" } },
  });

  for (const item of purchaseItems) {
    const serial =
      item.serials.find((row) => serialBelongsToProduct(row, productId)) ?? item.serials[0] ?? null;
    const imeis = normalizeDeviceImeis([
      ...item.serials.flatMap((row) => getDeviceImeis(row)),
      ...parseImeisSnapshot(item.imeisSnapshot),
    ]);
    const imeiLabel = imeis.length > 0 ? formatDeviceImeisLabel(imeis) : null;

    if (serial) {
      addRow({
        id: `${serial.id}-purchase`,
        type: "purchase",
        typeLabel: "فاتورة مشتريات",
        documentNumber: item.purchase.invoiceNumber,
        date: item.purchase.purchaseDate.toISOString(),
        detailUrl: `/dashboard/purchases/${item.purchase.id}`,
        quantity: item.quantity,
        unitPrice: serial.unitCost > 0.001 ? serial.unitCost : item.unitPrice,
        retailPrice: documentLineRetailPrice(item.retailPrice),
        counterparty: item.purchase.supplier.nameAr,
        imei: imeiLabel,
      });
      continue;
    }

    if (imeis.length > 0) {
      addRow({
        id: `${item.id}-purchase`,
        type: "purchase",
        typeLabel: "فاتورة مشتريات",
        documentNumber: item.purchase.invoiceNumber,
        date: item.purchase.purchaseDate.toISOString(),
        detailUrl: `/dashboard/purchases/${item.purchase.id}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        retailPrice: documentLineRetailPrice(item.retailPrice),
        counterparty: item.purchase.supplier.nameAr,
        imei: imeiLabel,
      });
      continue;
    }

    addRow({
      id: `${item.id}-purchase`,
      type: "purchase",
      typeLabel: "فاتورة مشتريات",
      documentNumber: item.purchase.invoiceNumber,
      date: item.purchase.purchaseDate.toISOString(),
      detailUrl: `/dashboard/purchases/${item.purchase.id}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: documentLineRetailPrice(item.retailPrice),
      counterparty: item.purchase.supplier.nameAr,
      imei: null,
    });
  }

  const stockEntryItems = await prisma.stockEntryItem.findMany({
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
        },
      },
      serials: {
        where: { branchId, productId },
        select: serialWithImeisSelect,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { stockEntry: { entryDate: "desc" } },
  });

  for (const item of stockEntryItems) {
    const serial =
      item.serials.find((row) => serialBelongsToProduct(row, productId)) ?? item.serials[0] ?? null;
    const imeis = normalizeDeviceImeis([
      ...item.serials.flatMap((row) => getDeviceImeis(row)),
      ...parseImeisSnapshot(item.imeisSnapshot),
    ]);
    const imeiLabel = imeis.length > 0 ? formatDeviceImeisLabel(imeis) : null;

    if (serial) {
      addRow({
        id: `${serial.id}-stock-entry`,
        type: "stock_entry",
        typeLabel: "رصيد افتتاحي",
        documentNumber: item.stockEntry.documentNumber,
        date: item.stockEntry.entryDate.toISOString(),
        detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
        quantity: item.quantity,
        unitPrice: serial.unitCost > 0.001 ? serial.unitCost : item.unitPrice,
        retailPrice: documentLineRetailPrice(item.retailPrice),
        counterparty: null,
        imei: imeiLabel,
      });
      continue;
    }

    if (imeis.length > 0) {
      addRow({
        id: `${item.id}-stock-entry`,
        type: "stock_entry",
        typeLabel: "رصيد افتتاحي",
        documentNumber: item.stockEntry.documentNumber,
        date: item.stockEntry.entryDate.toISOString(),
        detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        retailPrice: documentLineRetailPrice(item.retailPrice),
        counterparty: null,
        imei: imeiLabel,
      });
      continue;
    }

    addRow({
      id: `${item.id}-stock-entry`,
      type: "stock_entry",
      typeLabel: "رصيد افتتاحي",
      documentNumber: item.stockEntry.documentNumber,
      date: item.stockEntry.entryDate.toISOString(),
      detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: documentLineRetailPrice(item.retailPrice),
      counterparty: null,
      imei: null,
    });
  }

  const saleItems = await prisma.saleItem.findMany({
    where: {
      productId,
      sale: { branchId, status: "completed" },
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      imei: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          customer: { select: { nameAr: true } },
        },
      },
    },
  });

  for (const item of saleItems) {
    addRow({
      id: item.id,
      type: "sale",
      typeLabel: "فاتورة مبيعات",
      documentNumber: item.sale.invoiceNumber,
      date: item.sale.saleDate.toISOString(),
      detailUrl: `/dashboard/sales/${item.sale.id}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: null,
      counterparty: item.sale.customer?.nameAr || "عميل نقدي",
      imei: item.imei ? formatStoredDeviceImeis(item.imei) : null,
    });
  }

  return Array.from(invoiceMap.values()).sort((a, b) => compareNewestFirst(a.date, b.date));
}

