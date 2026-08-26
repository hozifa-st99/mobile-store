import { prisma } from "@/lib/prisma";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import { parseStocktakeSerials } from "@/lib/stocktake-serial-snapshot";
import { normalizeDeviceImeis } from "@/lib/product-serial-imeis";

export type InventoryMovementType =
  | "stock_entry"
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sale_return"
  | "stocktake";

export interface InventoryMovementEntry {
  id: string;
  type: InventoryMovementType;
  typeLabel: string;
  direction: "in" | "out";
  quantity: number;
  signedQuantity: number;
  balanceAfter: number;
  documentNumber: string;
  date: string;
  createdAt: string;
  partyName: string | null;
  detail: string | null;
  detailUrl: string;
}

export interface ProductMovementHistory {
  productId: string;
  productName: string;
  brand: string;
  productType: string;
  deviceCondition?: string | null;
  currentQuantity: number;
  movementCount: number;
  entries: InventoryMovementEntry[];
}

const TYPE_LABELS: Record<InventoryMovementType, string> = {
  stock_entry: "إدخال رصيد",
  purchase: "فاتورة مشتريات",
  purchase_return: "مرتجع مشتريات",
  sale: "فاتورة مبيعات",
  sale_return: "مرتجع مبيعات",
  stocktake: "تسوية / جرد",
};

type RawMovement = Omit<InventoryMovementEntry, "signedQuantity" | "balanceAfter"> & {
  /** بعد جرد بفرق: الرصيد = العدّ الفعلي المُسجّل */
  stocktakeCountedQuantity?: number;
};

function compareOldestFirst(
  dateA: Date | string,
  createdA: Date | string,
  dateB: Date | string,
  createdB: Date | string
): number {
  const docDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
  if (docDiff !== 0) return docDiff;
  return new Date(createdA).getTime() - new Date(createdB).getTime();
}

function pickImeis(...values: (string | null | undefined)[]): string[] {
  for (const value of values) {
    const imeis = parseImeisSnapshot(value);
    if (imeis.length > 0) return imeis;
  }
  return [];
}

function formatImeiDetailBlock(imeis: string[]): string | null {
  const list = normalizeDeviceImeis(imeis);
  if (list.length === 0) return null;
  return `IMEI:\n${list.join("\n")}`;
}

function combineMovementDetail(imeiBlock: string | null, suffix: string): string {
  return imeiBlock ? `${imeiBlock}\n${suffix}` : suffix;
}

function appendCycleLabel(detail: string | null, cycleIndex: number | undefined): string | null {
  if (!detail || cycleIndex == null || cycleIndex < 1) return detail;
  return `${detail}\nالدورة: ${cycleIndex}`;
}

async function loadDocumentLineCycleMap(
  branchId: string,
  productId: string
): Promise<Map<string, number>> {
  const serials = await prisma.productSerial.findMany({
    where: {
      branchId,
      productId,
      OR: [{ purchaseItemId: { not: null } }, { stockEntryItemId: { not: null } }],
    },
    select: { purchaseItemId: true, stockEntryItemId: true, cycleIndex: true },
  });

  const map = new Map<string, number>();
  for (const serial of serials) {
    if (serial.purchaseItemId) map.set(`purchase-${serial.purchaseItemId}`, serial.cycleIndex);
    if (serial.stockEntryItemId) {
      map.set(`stock-entry-${serial.stockEntryItemId}`, serial.cycleIndex);
    }
  }
  return map;
}

async function loadSerialCycleMap(serialIds: string[]): Promise<Map<string, number>> {
  if (serialIds.length === 0) return new Map();
  const serials = await prisma.productSerial.findMany({
    where: { id: { in: serialIds } },
    select: { id: true, cycleIndex: true },
  });
  return new Map(serials.map((serial) => [serial.id, serial.cycleIndex]));
}

/** IMEI لكل جهاز غائب على حدة — لا ندمج أجهزة مختلفة في كتلة واحدة */
function formatStocktakeAbsentImeiDetail(
  savedSerials: ReturnType<typeof parseStocktakeSerials>
): string | null {
  const absent = savedSerials.filter((serial) => !serial.present);
  if (absent.length === 0) return null;

  const blocks = absent
    .map((serial) => formatImeiDetailBlock(normalizeDeviceImeis(serial.imeis)))
    .filter((block): block is string => Boolean(block));

  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

/** جرد قديم بدون serialsSnapshot — نعرض IMEI فقط لو جهاز واحد ونقصه واحد */
function formatLegacyStocktakeImeiDetail(item: {
  imeiSnapshot: string | null;
  variance: number;
  systemQuantity: number;
}): string | null {
  if (item.variance >= 0) return null;
  const imeis = pickImeis(item.imeiSnapshot);
  if (imeis.length === 1 && Math.abs(item.variance) === 1 && item.systemQuantity === 1) {
    return formatImeiDetailBlock(imeis);
  }
  return null;
}

function withRunningBalance(rows: RawMovement[]): InventoryMovementEntry[] {
  let balance = 0;

  return rows.map((row) => {
    const signedQuantity = row.direction === "in" ? row.quantity : -row.quantity;

    if (row.type === "stocktake" && row.stocktakeCountedQuantity != null) {
      balance = Math.max(0, row.stocktakeCountedQuantity);
    } else if (row.quantity !== 0) {
      balance = Math.max(0, balance + signedQuantity);
    }

    const { stocktakeCountedQuantity: _ignored, ...entryRow } = row;
    return {
      ...entryRow,
      signedQuantity,
      balanceAfter: balance,
    };
  });
}

/** دخول أجهزة — من مستندات الإدخال والمشتريات (ثابت حتى بعد حذف السيريال بالجرد) */
async function loadPhoneInboundMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const rows: RawMovement[] = [];

  const [stockEntryItems, purchaseItems] = await Promise.all([
    prisma.stockEntryItem.findMany({
      where: { productId, stockEntry: { branchId, status: "completed" } },
      select: {
        id: true,
        quantity: true,
        description: true,
        imeisSnapshot: true,
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
    prisma.purchaseItem.findMany({
      where: { productId, purchase: { branchId, status: "completed" } },
      select: {
        id: true,
        quantity: true,
        description: true,
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
      },
    }),
  ]);

  const cycleMap = await loadDocumentLineCycleMap(branchId, productId);

  for (const item of stockEntryItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imeisSnapshot));
    if (!imeiBlock) continue;

    rows.push({
      id: `stock-entry-${item.id}`,
      type: "stock_entry",
      typeLabel: TYPE_LABELS.stock_entry,
      direction: "in",
      quantity: 1,
      documentNumber: item.stockEntry.documentNumber,
      date: item.stockEntry.entryDate.toISOString(),
      createdAt: item.stockEntry.createdAt.toISOString(),
      partyName: null,
      detail: appendCycleLabel(imeiBlock, cycleMap.get(`stock-entry-${item.id}`)),
      detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
    });
  }

  for (const item of purchaseItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imeisSnapshot));
    if (!imeiBlock) continue;

    rows.push({
      id: `purchase-${item.id}`,
      type: "purchase",
      typeLabel: TYPE_LABELS.purchase,
      direction: "in",
      quantity: 1,
      documentNumber: item.purchase.invoiceNumber,
      date: item.purchase.purchaseDate.toISOString(),
      createdAt: item.purchase.createdAt.toISOString(),
      partyName: item.purchase.supplier.nameAr,
      detail: appendCycleLabel(imeiBlock, cycleMap.get(`purchase-${item.id}`)),
      detailUrl: `/dashboard/purchases/${item.purchase.id}`,
    });
  }

  return rows;
}

/** مبيعات الموبايل — من sale_items مباشرة */
async function loadPhoneSaleMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const saleItems = await prisma.saleItem.findMany({
    where: { productId, sale: { branchId, status: "completed" } },
    select: {
      id: true,
      quantity: true,
      imei: true,
      serialId: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          createdAt: true,
          customer: { select: { nameAr: true } },
        },
      },
    },
  });

  const serialIds = saleItems
    .map((item) => item.serialId)
    .filter((id): id is string => Boolean(id));
  const cycleMap = await loadSerialCycleMap(serialIds);

  return saleItems.map((item) => {
    const imeiBlock = item.imei ? formatImeiDetailBlock(pickImeis(item.imei)) : null;
    return {
      id: `sale-${item.id}`,
      type: "sale" as const,
      typeLabel: TYPE_LABELS.sale,
      direction: "out" as const,
      quantity: item.quantity,
      documentNumber: item.sale.invoiceNumber,
      date: item.sale.saleDate.toISOString(),
      createdAt: item.sale.createdAt.toISOString(),
      partyName: item.sale.customer?.nameAr || "عميل نقدي",
      detail: appendCycleLabel(imeiBlock, item.serialId ? cycleMap.get(item.serialId) : undefined),
      detailUrl: `/dashboard/sales/${item.sale.id}`,
    };
  });
}

/** إكسسوارات — بنود مشتريات وإدخال رصيد */
async function loadAccessoryInboundMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const rows: RawMovement[] = [];

  const [stockEntryItems, purchaseItems] = await Promise.all([
    prisma.stockEntryItem.findMany({
      where: { productId, stockEntry: { branchId, status: "completed" } },
      select: {
        id: true,
        quantity: true,
        description: true,
        imeisSnapshot: true,
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
    prisma.purchaseItem.findMany({
      where: { productId, purchase: { branchId, status: "completed" } },
      select: {
        id: true,
        quantity: true,
        description: true,
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
      },
    }),
  ]);

  for (const item of stockEntryItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imeisSnapshot));
    rows.push({
      id: `stock-entry-${item.id}`,
      type: "stock_entry",
      typeLabel: TYPE_LABELS.stock_entry,
      direction: "in",
      quantity: item.quantity,
      documentNumber: item.stockEntry.documentNumber,
      date: item.stockEntry.entryDate.toISOString(),
      createdAt: item.stockEntry.createdAt.toISOString(),
      partyName: null,
      detail: imeiBlock ?? item.description,
      detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
    });
  }

  for (const item of purchaseItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imeisSnapshot));
    rows.push({
      id: `purchase-${item.id}`,
      type: "purchase",
      typeLabel: TYPE_LABELS.purchase,
      direction: "in",
      quantity: item.quantity,
      documentNumber: item.purchase.invoiceNumber,
      date: item.purchase.purchaseDate.toISOString(),
      createdAt: item.purchase.createdAt.toISOString(),
      partyName: item.purchase.supplier.nameAr,
      detail: imeiBlock ?? item.description,
      detailUrl: `/dashboard/purchases/${item.purchase.id}`,
    });
  }

  return rows;
}

/** مبيعات الإكسسوارات */
async function loadAccessorySaleMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const saleItems = await prisma.saleItem.findMany({
    where: { productId, sale: { branchId, status: "completed" } },
    select: {
      id: true,
      quantity: true,
      description: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          createdAt: true,
          customer: { select: { nameAr: true } },
        },
      },
    },
  });

  return saleItems.map((item) => ({
    id: `sale-${item.id}`,
    type: "sale" as const,
    typeLabel: TYPE_LABELS.sale,
    direction: "out" as const,
    quantity: item.quantity,
    documentNumber: item.sale.invoiceNumber,
    date: item.sale.saleDate.toISOString(),
    createdAt: item.sale.createdAt.toISOString(),
    partyName: item.sale.customer?.nameAr || "عميل نقدي",
    detail: item.description,
    detailUrl: `/dashboard/sales/${item.sale.id}`,
  }));
}

async function loadReturnMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const rows: RawMovement[] = [];

  const [purchaseReturnItems, saleReturnItems] = await Promise.all([
    prisma.purchaseReturnItem.findMany({
      where: { productId, purchaseReturn: { branchId } },
      select: {
        id: true,
        quantity: true,
        description: true,
        imeisSnapshot: true,
        purchaseReturn: {
          select: {
            id: true,
            returnNumber: true,
            returnDate: true,
            createdAt: true,
            purchase: {
              select: {
                id: true,
                invoiceNumber: true,
                supplier: { select: { nameAr: true } },
              },
            },
          },
        },
      },
    }),
    prisma.saleReturnItem.findMany({
      where: { productId, saleReturn: { branchId } },
      select: {
        id: true,
        quantity: true,
        description: true,
        imei: true,
        saleReturn: {
          select: {
            id: true,
            returnNumber: true,
            returnDate: true,
            createdAt: true,
            sale: {
              select: {
                id: true,
                invoiceNumber: true,
                customer: { select: { nameAr: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  for (const item of purchaseReturnItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imeisSnapshot));
    rows.push({
      id: `purchase-return-${item.id}`,
      type: "purchase_return",
      typeLabel: TYPE_LABELS.purchase_return,
      direction: "out",
      quantity: item.quantity,
      documentNumber: item.purchaseReturn.returnNumber,
      date: item.purchaseReturn.returnDate.toISOString(),
      createdAt: item.purchaseReturn.createdAt.toISOString(),
      partyName: item.purchaseReturn.purchase.supplier.nameAr,
      detail: combineMovementDetail(
        imeiBlock,
        `فاتورة ${item.purchaseReturn.purchase.invoiceNumber}`
      ),
      detailUrl: `/dashboard/purchases/${item.purchaseReturn.purchase.id}`,
    });
  }

  for (const item of saleReturnItems) {
    const imeiBlock = formatImeiDetailBlock(pickImeis(item.imei));
    rows.push({
      id: `sale-return-${item.id}`,
      type: "sale_return",
      typeLabel: TYPE_LABELS.sale_return,
      direction: "in",
      quantity: item.quantity,
      documentNumber: item.saleReturn.returnNumber,
      date: item.saleReturn.returnDate.toISOString(),
      createdAt: item.saleReturn.createdAt.toISOString(),
      partyName: item.saleReturn.sale.customer?.nameAr || "عميل نقدي",
      detail: combineMovementDetail(
        imeiBlock,
        `فاتورة ${item.saleReturn.sale.invoiceNumber}`
      ),
      detailUrl: `/dashboard/sales/${item.saleReturn.sale.id}`,
    });
  }

  return rows;
}

/** كل مستندات الجرد — بما فيها المطابقة (فرق 0) */
async function loadStocktakeMovements(
  branchId: string,
  productId: string
): Promise<RawMovement[]> {
  const items = await prisma.stocktakeItem.findMany({
    where: { productId, stocktake: { branchId, status: "completed" } },
    select: {
      id: true,
      variance: true,
      countedQuantity: true,
      systemQuantity: true,
      description: true,
      imeiSnapshot: true,
      serialsSnapshot: true,
      stocktake: {
        select: {
          id: true,
          documentNumber: true,
          stocktakeDate: true,
          createdAt: true,
          mode: true,
          user: { select: { fullNameAr: true, username: true } },
        },
      },
    },
  });

  const rows: RawMovement[] = [];

  for (const item of items) {
    const variance = item.variance;
    const savedSerials = parseStocktakeSerials(item.serialsSnapshot);
    const imeiBlock =
      formatStocktakeAbsentImeiDetail(savedSerials) ??
      formatLegacyStocktakeImeiDetail(item);
    const modeLabel = item.stocktake.mode === "full" ? "جرد كلي" : "جرد جزئي";
    const userName = item.stocktake.user?.fullNameAr || item.stocktake.user?.username;
    const partyName = userName ? `${modeLabel} — ${userName}` : modeLabel;

    // جرد بدون فرق (variance = 0) = مطابقة فقط — لا يُعرض في سجل الحركة
    if (variance === 0) continue;

    const varianceNote =
      variance > 0 ? `زيادة ${variance}` : `نقص ${Math.abs(variance)}`;

    rows.push({
      id: `stocktake-${item.id}`,
      type: "stocktake",
      typeLabel: TYPE_LABELS.stocktake,
      direction: variance > 0 ? "in" : "out",
      quantity: Math.abs(variance),
      stocktakeCountedQuantity: item.countedQuantity,
      documentNumber: item.stocktake.documentNumber,
      date: item.stocktake.stocktakeDate.toISOString(),
      createdAt: item.stocktake.createdAt.toISOString(),
      partyName,
      detail: imeiBlock
        ? combineMovementDetail(imeiBlock, varianceNote)
        : `${varianceNote} — عدّ ${item.countedQuantity}`,
      detailUrl: `/dashboard/inventory/stocktake/${item.stocktake.id}`,
    });
  }

  return rows;
}

async function loadProductMovementRows(
  branchId: string,
  productId: string,
  isPhone: boolean
): Promise<RawMovement[]> {
  const [inbound, sales, returns, stocktakes] = await Promise.all([
    isPhone
      ? loadPhoneInboundMovements(branchId, productId)
      : loadAccessoryInboundMovements(branchId, productId),
    isPhone
      ? loadPhoneSaleMovements(branchId, productId)
      : loadAccessorySaleMovements(branchId, productId),
    loadReturnMovements(branchId, productId),
    loadStocktakeMovements(branchId, productId),
  ]);

  const raw: RawMovement[] = [...inbound, ...sales, ...returns, ...stocktakes];
  raw.sort((a, b) => compareOldestFirst(a.date, a.createdAt, b.date, b.createdAt));
  return raw;
}

function computeQuantityFromMovementRows(rows: RawMovement[]): number {
  const entries = withRunningBalance(rows);
  return entries.length > 0 ? entries[entries.length - 1].balanceAfter : 0;
}

export async function getProductMovementHistory(
  branchId: string,
  companyId: string,
  productId: string
): Promise<ProductMovementHistory | null> {
  const inventory = await prisma.branchInventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
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
  const raw = await loadProductMovementRows(branchId, productId, isPhone);
  const entries = withRunningBalance(raw);
  const currentQuantity = computeQuantityFromMovementRows(raw);
  const displayEntries = [...entries].reverse();

  return {
    productId: inventory.product.id,
    productName: inventory.product.nameAr,
    brand: inventory.product.brand,
    productType: inventory.product.type,
    deviceCondition: inventory.product.deviceCondition,
    currentQuantity,
    movementCount: displayEntries.length,
    entries: displayEntries,
  };
}
