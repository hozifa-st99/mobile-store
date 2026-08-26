import "server-only";

import { prisma } from "@/lib/prisma";
import { buildPurchaseItemDescription } from "@/lib/phone-product";
import { formatDeviceImeisLabel, getDeviceImeis } from "@/lib/product-serial-imeis";
import type { StocktakeLine, StocktakeSerialLine } from "@/lib/stocktake-line-types";
import {
  buildPhoneGroupDetails,
  buildPhoneGroupKey,
  groupPhoneStocktakeLines,
  recomputePhoneLineFromSerials,
} from "@/lib/stocktake-line-utils";

export type { StocktakeLine, StocktakeSerialLine } from "@/lib/stocktake-line-types";

function buildAccessoryDetails(name: string, barcode: string | null): string {
  const parts = [name];
  if (barcode?.trim()) parts.push(`باركود: ${barcode.trim()}`);
  return parts.join("\n");
}

function matchesSearch(line: StocktakeLine, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (line.name.toLowerCase().includes(q)) return true;
  if (line.brand.toLowerCase().includes(q)) return true;
  if (line.barcode?.toLowerCase().includes(q)) return true;
  if (line.imeis.some((imei) => imei.toLowerCase().includes(q))) return true;
  if (line.serials.some((s) => s.barcode?.toLowerCase().includes(q))) return true;
  return false;
}

export async function loadStocktakeLines(
  branchId: string,
  companyId: string,
  options?: { search?: string; productIds?: string[] }
): Promise<StocktakeLine[]> {
  const search = options?.search?.trim() || "";
  const productIds = options?.productIds;

  const inventories = await prisma.branchInventory.findMany({
    where: {
      branchId,
      product: {
        deletedAt: null,
        isActive: true,
        companyId,
        ...(productIds?.length ? { id: { in: productIds } } : {}),
      },
    },
    include: {
      product: {
        select: {
          id: true,
          nameAr: true,
          brand: true,
          type: true,
          barcode: true,
          phoneModelId: true,
          phoneBrandId: true,
          itemCategoryId: true,
          color: true,
          storage: true,
          ram: true,
          deviceCondition: true,
          boxCondition: true,
          batteryPercent: true,
          phoneBrand: { select: { id: true, nameAr: true } },
          itemCategory: { select: { id: true, nameAr: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (inventories.length === 0) return [];

  const ids = inventories.map((inv) => inv.productId);
  const serialRows = await prisma.productSerial.findMany({
    where: {
      branchId,
      productId: { in: ids },
      status: "available",
    },
    select: {
      id: true,
      productId: true,
      barcode: true,
      unitCost: true,
      imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const serialsByProduct = new Map<string, StocktakeSerialLine[]>();
  const imeisByProduct = new Map<string, string[]>();
  for (const serial of serialRows) {
    const imeis = getDeviceImeis(serial);
    const list = serialsByProduct.get(serial.productId) ?? [];
    list.push({
      id: serial.id,
      productId: serial.productId,
      imei: imeis.length > 0 ? formatDeviceImeisLabel(imeis) : null,
      imeis,
      barcode: serial.barcode?.trim() || null,
      unitCost: serial.unitCost,
      present: true,
    });
    serialsByProduct.set(serial.productId, list);

    if (imeis.length > 0) {
      const allImeis = imeisByProduct.get(serial.productId) ?? [];
      allImeis.push(...imeis);
      imeisByProduct.set(serial.productId, allImeis);
    }
  }

  const rawLines: StocktakeLine[] = inventories.map((inv) => {
    const serials = serialsByProduct.get(inv.productId) ?? [];
    const imeis = imeisByProduct.get(inv.productId) ?? [];
    const barcode =
      inv.product.barcode?.trim() ||
      serials.find((s) => s.barcode)?.barcode ||
      null;
    const isPhone = inv.product.type === "phone";
    const systemQuantity =
      isPhone && serials.length > 0 ? serials.length : inv.quantity;
    const unitCost =
      isPhone && serials.length > 0
        ? serials.reduce((sum, serial) => sum + serial.unitCost, 0) / serials.length
        : inv.purchasePrice;
    const displayName = isPhone
      ? buildPurchaseItemDescription(inv.product.nameAr, {
          color: inv.product.color ?? undefined,
          storage: inv.product.storage ?? undefined,
          ram: inv.product.ram ?? undefined,
          deviceCondition: inv.product.deviceCondition,
          boxCondition: inv.product.boxCondition,
          batteryPercent: inv.product.batteryPercent,
        })
      : inv.product.nameAr;

    const details = isPhone
      ? buildPhoneGroupDetails(displayName, serials.length > 0 ? serials.length : systemQuantity)
      : buildAccessoryDetails(displayName, barcode);

    return {
      lineId: inv.productId,
      productId: inv.productId,
      productIds: [inv.productId],
      groupKey: isPhone
        ? buildPhoneGroupKey({
            phoneModelId: inv.product.phoneModelId,
            name: inv.product.nameAr,
            brand: inv.product.brand,
            color: inv.product.color,
            storage: inv.product.storage,
            ram: inv.product.ram,
            deviceCondition: inv.product.deviceCondition,
            boxCondition: inv.product.boxCondition,
            batteryPercent: inv.product.batteryPercent,
          })
        : null,
      name: inv.product.nameAr,
      brand: inv.product.brand,
      productType: inv.product.type,
      phoneBrandId: inv.product.phoneBrandId,
      phoneBrandName: inv.product.phoneBrand?.nameAr ?? inv.product.brand,
      itemCategoryId: inv.product.itemCategoryId,
      itemCategoryName: inv.product.itemCategory?.nameAr ?? null,
      barcode,
      imeis,
      serials,
      details,
      systemQuantity,
      countedQuantity: systemQuantity,
      variance: 0,
      unitCost,
    };
  });

  const grouped = groupPhoneStocktakeLines(rawLines).map((line) =>
    line.productType === "phone" ? recomputePhoneLineFromSerials(line) : line
  );
  if (!search) return grouped;
  return grouped.filter((line) => matchesSearch(line, search));
}
