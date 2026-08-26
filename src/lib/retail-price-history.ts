import "server-only";

import { prisma } from "@/lib/prisma";
import { listRetailPriceChanges } from "@/lib/retail-price-change-store";
import { loadPhoneProductInvoiceRows } from "@/lib/phone-product-serials";
import { formatStoredDeviceImeis, getStoredDeviceImeis } from "@/lib/product-serial-imeis";
import type {
  ProductInvoiceRow,
  ProductRetailPriceHistory,
  RetailPriceChangeRow,
} from "@/lib/retail-price-history-types";

export type {
  ProductInvoiceRow,
  ProductRetailPriceHistory,
  RetailPriceChangeRow,
} from "@/lib/retail-price-history-types";
function compareNewestFirst(dateA: Date | string, dateB: Date | string): number {
  return new Date(dateB).getTime() - new Date(dateA).getTime();
}

function invoiceKey(row: Pick<ProductInvoiceRow, "type" | "id" | "imei">) {
  return `${row.type}-${row.id}-${row.imei ?? ""}`;
}

async function loadPhoneInvoices(branchId: string, productId: string): Promise<ProductInvoiceRow[]> {
  return loadPhoneProductInvoiceRows(branchId, productId);
}

async function loadFirstSaleAfter(
  branchId: string,
  productId: string,
  changedAt: Date,
  imei?: string | null
) {
  const targetImeis = new Set(getStoredDeviceImeis(imei));
  const items = await prisma.saleItem.findMany({
    where: {
      productId,
      sale: {
        branchId,
        status: "completed",
        saleDate: { gte: changedAt },
      },
    },
    orderBy: { sale: { saleDate: "asc" } },
    select: {
      imei: true,
      unitPrice: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
        },
      },
    },
  });

  const item = imei
    ? items.find((row) => {
        if (!row.imei) return false;
        if (row.imei.trim() === imei.trim()) return true;
        return getStoredDeviceImeis(row.imei).some((value) => targetImeis.has(value));
      })
    : items[0];

  if (!item) return null;

  return {
    invoiceNumber: item.sale.invoiceNumber,
    saleDate: item.sale.saleDate.toISOString(),
    detailUrl: `/dashboard/sales/${item.sale.id}`,
    unitPrice: item.unitPrice,
  };
}

async function loadChanges(
  branchId: string,
  productId: string
): Promise<RetailPriceChangeRow[]> {
  const rows = await listRetailPriceChanges(prisma, branchId, productId);
  const userIds = rows.map((row) => row.userId).filter(Boolean) as string[];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullNameAr: true, username: true },
        })
      : [];
  const userMap = new Map(users.map((user) => [user.id, user.fullNameAr || user.username]));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      changedAt: row.changedAt.toISOString(),
      oldPrice: row.oldPrice,
      newPrice: row.newPrice,
      reason: row.reason,
      userName: row.userId ? userMap.get(row.userId) ?? null : null,
      serialId: row.serialId,
      imei: row.imei,
      firstSaleAfter: await loadFirstSaleAfter(branchId, productId, row.changedAt, row.imei),
    }))
  );
}

async function loadInvoices(
  branchId: string,
  productId: string,
  product: { type: string; barcode: string | null }
): Promise<ProductInvoiceRow[]> {
  if (product.type === "phone") {
    return loadPhoneInvoices(branchId, productId);
  }

  const invoiceMap = new Map<string, ProductInvoiceRow>();

  const addInvoice = (row: ProductInvoiceRow) => {
    invoiceMap.set(invoiceKey(row), row);
  };

  const [purchaseItems, stockEntryItems, saleItems] = await Promise.all([
    prisma.purchaseItem.findMany({
      where: {
        productId,
        purchase: { branchId, status: "completed" },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        retailPrice: true,
        purchase: {
          select: {
            id: true,
            invoiceNumber: true,
            purchaseDate: true,
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
          },
        },
      },
    }),
    prisma.saleItem.findMany({
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
    }),
  ]);

  for (const item of purchaseItems) {
    addInvoice({
      id: item.id,
      type: "purchase",
      typeLabel: "فاتورة مشتريات",
      documentNumber: item.purchase.invoiceNumber,
      date: item.purchase.purchaseDate.toISOString(),
      detailUrl: `/dashboard/purchases/${item.purchase.id}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      counterparty: item.purchase.supplier.nameAr,
      imei: null,
    });
  }

  for (const item of stockEntryItems) {
    addInvoice({
      id: item.id,
      type: "stock_entry",
      typeLabel: "رصيد افتتاحي",
      documentNumber: item.stockEntry.documentNumber,
      date: item.stockEntry.entryDate.toISOString(),
      detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      counterparty: null,
      imei: null,
    });
  }

  for (const item of saleItems) {
    addInvoice({
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
      imei: item.imei,
    });
  }

  if (product.barcode) {
    const [purchaseByBarcode, stockByBarcode, salesByBarcode] = await Promise.all([
      prisma.purchaseItem.findMany({
        where: {
          barcode: product.barcode,
          productId: null,
          purchase: { branchId, status: "completed" },
        },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          retailPrice: true,
          purchase: {
            select: {
              id: true,
              invoiceNumber: true,
              purchaseDate: true,
              supplier: { select: { nameAr: true } },
            },
          },
        },
      }),
      prisma.stockEntryItem.findMany({
        where: {
          barcode: product.barcode,
          productId: null,
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
            },
          },
        },
      }),
      prisma.saleItem.findMany({
        where: {
          barcode: product.barcode,
          productId: null,
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
      }),
    ]);

    for (const item of purchaseByBarcode) {
      addInvoice({
        id: item.id,
        type: "purchase",
        typeLabel: "فاتورة مشتريات",
        documentNumber: item.purchase.invoiceNumber,
        date: item.purchase.purchaseDate.toISOString(),
        detailUrl: `/dashboard/purchases/${item.purchase.id}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        retailPrice: item.retailPrice,
        counterparty: item.purchase.supplier.nameAr,
        imei: null,
      });
    }

    for (const item of stockByBarcode) {
      addInvoice({
        id: item.id,
        type: "stock_entry",
        typeLabel: "رصيد افتتاحي",
        documentNumber: item.stockEntry.documentNumber,
        date: item.stockEntry.entryDate.toISOString(),
        detailUrl: `/dashboard/stock-entries/${item.stockEntry.id}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        retailPrice: item.retailPrice,
        counterparty: null,
        imei: null,
      });
    }

    for (const item of salesByBarcode) {
      addInvoice({
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
        imei: item.imei,
      });
    }
  }

  return Array.from(invoiceMap.values()).sort((a, b) => compareNewestFirst(a.date, b.date));
}

export async function loadProductRetailPriceHistory(
  branchId: string,
  productId: string
): Promise<ProductRetailPriceHistory | null> {
  const inventory = await prisma.branchInventory.findFirst({
    where: {
      branchId,
      productId,
      product: { deletedAt: null },
    },
    include: {
      product: { select: { nameAr: true, brand: true, type: true, barcode: true } },
    },
  });

  if (!inventory) return null;

  const [changes, invoices] = await Promise.all([
    loadChanges(branchId, productId),
    loadInvoices(branchId, productId, {
      type: inventory.product.type,
      barcode: inventory.product.barcode,
    }),
  ]);

  return {
    productId,
    productName: inventory.product.nameAr,
    brand: inventory.product.brand,
    productType: inventory.product.type,
    currentPurchasePrice: inventory.purchasePrice,
    currentRetailPrice: inventory.retailPrice,
    changes,
    changedImeis: Array.from(
      new Set(
        changes
          .map((change) =>
            change.imei ? formatStoredDeviceImeis(change.imei) : null
          )
          .filter((value): value is string => Boolean(value) && value !== "—")
      )
    ),
    invoices,
  };
}
