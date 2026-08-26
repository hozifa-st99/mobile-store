import type { Prisma } from "@prisma/client";

import {
  formatDeviceImeisLabel,
  getDeviceImeis,
} from "@/lib/product-serial-imeis";
import {
  getSerialEffectivePurchasePrice,
  getSerialEffectiveRetailPrice,
} from "@/lib/phone-serial-pricing";
import {
  boxConditionLabel,
  deviceConditionLabel,
  sourceKindLabel,
  taxStatusLabel,
} from "@/lib/phone-device-display";

export interface PhoneDeviceSource {
  kind: "purchase" | "stock_entry";
  kindLabel: string;
  documentNumber: string;
  documentDate: string;
  documentUrl: string;
  counterparty: string | null;
}

export interface PhoneDeviceDetails {
  warrantyMonths: number;
  taxStatus: string;
  taxStatusLabel: string;
  deviceCondition: string;
  deviceConditionLabel: string;
  boxCondition: string | null;
  boxConditionLabel: string | null;
  batteryPercent: number | null;
  itemNotes: string | null;
  unitPrice: number;
  retailPrice: number;
  barcode: string | null;
  color: string | null;
  storage: string | null;
  ram: string | null;
}

export interface PhoneDeviceRow {
  serialId: string;
  imeis: string[];
  imeiLabel: string;
  barcode: string | null;
  cycleIndex: number;
  purchasePrice: number;
  retailPrice: number;
  deviceCondition: string;
  product: {
    id: string;
    name: string;
    brand: string;
    color: string | null;
    storage: string | null;
    ram: string | null;
    imageUrl: string | null;
    phoneBrandName: string | null;
    phoneModelName: string | null;
    phonePlatformId: string | null;
    phoneBrandId: string | null;
  };
  source: PhoneDeviceSource | null;
  details: PhoneDeviceDetails;
}

export const phoneSerialDetailsInclude = (branchId: string) =>
  ({
    product: {
      include: {
        phoneBrand: { select: { nameAr: true } },
        phoneModel: { select: { nameAr: true } },
        inventories: {
          where: { branchId },
          select: { retailPrice: true },
          take: 1,
        },
      },
    },
    imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" as const } },
    purchaseItem: {
      select: {
        productId: true,
        warrantyMonths: true,
        taxStatus: true,
        deviceCondition: true,
        boxCondition: true,
        batteryPercent: true,
        itemNotes: true,
        unitPrice: true,
        retailPrice: true,
        barcode: true,
        purchase: {
          select: {
            id: true,
            invoiceNumber: true,
            purchaseDate: true,
            supplier: { select: { nameAr: true } },
          },
        },
      },
    },
    stockEntryItem: {
      select: {
        productId: true,
        warrantyMonths: true,
        deviceCondition: true,
        boxCondition: true,
        batteryPercent: true,
        itemNotes: true,
        unitPrice: true,
        retailPrice: true,
        barcode: true,
        stockEntry: {
          select: {
            id: true,
            documentNumber: true,
            entryDate: true,
          },
        },
      },
    },
  }) satisfies Prisma.ProductSerialInclude;

export type PhoneSerialWithDetails = Prisma.ProductSerialGetPayload<{
  include: ReturnType<typeof phoneSerialDetailsInclude>;
}>;

export function mapSerialToPhoneDeviceRow(serial: PhoneSerialWithDetails): PhoneDeviceRow {
  const imeis = getDeviceImeis(serial);
  const inventoryRetail = serial.product.inventories[0]?.retailPrice ?? serial.retailPrice;
  const line = serial.purchaseItem ?? serial.stockEntryItem;
  const sourceKind = serial.purchaseItem ? ("purchase" as const) : ("stock_entry" as const);

  const deviceCondition = line?.deviceCondition ?? serial.product.deviceCondition;
  const boxCondition = line?.boxCondition ?? serial.product.boxCondition;
  const batteryPercent = line?.batteryPercent ?? serial.product.batteryPercent;
  const taxStatus = serial.purchaseItem?.taxStatus ?? serial.product.taxStatus;

  return {
    serialId: serial.id,
    imeis,
    imeiLabel: imeis.length > 0 ? formatDeviceImeisLabel(imeis) : "—",
    barcode: serial.barcode ?? line?.barcode ?? serial.product.barcode,
    cycleIndex: serial.cycleIndex,
    purchasePrice: getSerialEffectivePurchasePrice(serial),
    retailPrice: getSerialEffectiveRetailPrice(
      {
        unitCost: serial.unitCost,
        retailPrice: serial.retailPrice,
        purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
        stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
      },
      inventoryRetail
    ),
    deviceCondition,
    product: {
      id: serial.product.id,
      name: serial.product.nameAr,
      brand: serial.product.brand,
      color: serial.product.color,
      storage: serial.product.storage,
      ram: serial.product.ram,
      imageUrl: serial.product.imageUrl,
      phoneBrandName: serial.product.phoneBrand?.nameAr ?? null,
      phoneModelName: serial.product.phoneModel?.nameAr ?? null,
      phonePlatformId: serial.product.phonePlatformId,
      phoneBrandId: serial.product.phoneBrandId,
    },
    source: serial.purchaseItem
      ? {
          kind: sourceKind,
          kindLabel: sourceKindLabel(sourceKind),
          documentNumber: serial.purchaseItem.purchase.invoiceNumber,
          documentDate: serial.purchaseItem.purchase.purchaseDate.toISOString(),
          documentUrl: `/dashboard/purchases/${serial.purchaseItem.purchase.id}`,
          counterparty: serial.purchaseItem.purchase.supplier.nameAr,
        }
      : serial.stockEntryItem
        ? {
            kind: sourceKind,
            kindLabel: sourceKindLabel(sourceKind),
            documentNumber: serial.stockEntryItem.stockEntry.documentNumber,
            documentDate: serial.stockEntryItem.stockEntry.entryDate.toISOString(),
            documentUrl: `/dashboard/stock-entries/${serial.stockEntryItem.stockEntry.id}`,
            counterparty: null,
          }
        : null,
    details: {
      warrantyMonths: line?.warrantyMonths ?? serial.product.warrantyMonths,
      taxStatus,
      taxStatusLabel: taxStatusLabel(taxStatus),
      deviceCondition,
      deviceConditionLabel: deviceConditionLabel(deviceCondition),
      boxCondition,
      boxConditionLabel: boxConditionLabel(boxCondition),
      batteryPercent,
      itemNotes: line?.itemNotes ?? serial.product.description,
      unitPrice: line?.unitPrice ?? serial.unitCost,
      retailPrice: line?.retailPrice ?? serial.retailPrice,
      barcode: line?.barcode ?? serial.barcode ?? serial.product.barcode,
      color: serial.product.color,
      storage: serial.product.storage,
      ram: serial.product.ram,
    },
  };
}
