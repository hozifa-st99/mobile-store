import type { PrismaClient } from "@prisma/client";

import type {
  CatalogAvailabilitySerialsPayload,
  CatalogAvailabilitySerialUnit,
} from "@/lib/catalog-availability-serials";
import { deviceConditionLabel } from "@/lib/phone-device-display";
import { getSerialEffectiveRetailPrice } from "@/lib/phone-serial-pricing";
import { formatDeviceImeisLabel, getDeviceImeis } from "@/lib/product-serial-imeis";

export type { CatalogAvailabilitySerialsPayload, CatalogAvailabilitySerialUnit } from "@/lib/catalog-availability-serials";

function buildVariantLabel(
  color: string | null | undefined,
  storage: string | null | undefined,
  ram: string | null | undefined
): string {
  const parts = [color?.trim(), storage?.trim(), ram?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "جهاز";
}

export async function loadCatalogAvailabilitySerials(
  prisma: PrismaClient,
  companyId: string,
  params: {
    productId?: string;
    phoneModelId?: string;
    branchId?: string;
    excludeBranchId?: string;
    title?: string;
    subtitle?: string;
  }
): Promise<CatalogAvailabilitySerialsPayload> {
  if (!params.productId && !params.phoneModelId) {
    throw new Error("PRODUCT_OR_MODEL_REQUIRED");
  }

  const serials = await prisma.productSerial.findMany({
    where: {
      status: "available",
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.excludeBranchId ? { branchId: { not: params.excludeBranchId } } : {}),
      product: {
        companyId,
        deletedAt: null,
        isActive: true,
        type: "phone",
        ...(params.productId ? { id: params.productId } : {}),
        ...(params.phoneModelId ? { phoneModelId: params.phoneModelId } : {}),
      },
    },
    orderBy: [{ branch: { nameAr: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      branchId: true,
      retailPrice: true,
      unitCost: true,
      branch: { select: { id: true, nameAr: true, code: true } },
      imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
      product: {
        select: {
          color: true,
          storage: true,
          ram: true,
          deviceCondition: true,
          inventories: {
            select: { branchId: true, retailPrice: true },
          },
        },
      },
      purchaseItem: { select: { deviceCondition: true, retailPrice: true } },
      stockEntryItem: { select: { deviceCondition: true, retailPrice: true } },
    },
  });

  const units: CatalogAvailabilitySerialUnit[] = serials.map((serial) => {
    const imeis = getDeviceImeis(serial);
    const inventoryRetail =
      serial.product.inventories.find((row) => row.branchId === serial.branchId)?.retailPrice ?? 0;
    const line = serial.purchaseItem ?? serial.stockEntryItem;
    const deviceCondition = line?.deviceCondition ?? serial.product.deviceCondition;

    return {
      serialId: serial.id,
      imeis,
      imeiLabel: imeis.length > 0 ? formatDeviceImeisLabel(imeis) : "—",
      deviceCondition,
      deviceConditionLabel: deviceConditionLabel(deviceCondition),
      retailPrice: getSerialEffectiveRetailPrice(
        {
          unitCost: serial.unitCost,
          retailPrice: serial.retailPrice,
          purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
          stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
        },
        inventoryRetail
      ),
      branchId: serial.branch.id,
      branchName: serial.branch.nameAr,
      branchCode: serial.branch.code,
      color: serial.product.color,
      storage: serial.product.storage,
      ram: serial.product.ram,
      variantLabel: buildVariantLabel(serial.product.color, serial.product.storage, serial.product.ram),
    };
  });

  return {
    title: params.title?.trim() || "تفاصيل الأجهزة",
    subtitle: params.subtitle?.trim() || "",
    units,
  };
}
