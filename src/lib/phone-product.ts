import type { Prisma } from "@prisma/client";
import { buildPhoneDescription } from "@/lib/phone-model-options";
import { ensureUniqueBarcode } from "@/lib/barcode-server";
import { phoneCatalogLogoUrl } from "@/lib/product-image";
import { parseTaxStatus, type TaxStatus } from "@/lib/phone-device-display";

type Tx = Prisma.TransactionClient;

export interface PhoneProductInput {
  phoneModelId: string;
  color?: string;
  storage?: string;
  ram?: string;
  unitPrice: number;
  retailPrice?: number;
  barcode?: string;
  warrantyMonths?: number;
  taxStatus?: TaxStatus;
  deviceCondition?: "new" | "used";
  boxCondition?: string | null;
  batteryPercent?: number | null;
  itemNotes?: string | null;
}

export async function resolveOrCreatePhoneProduct(
  tx: Tx,
  auth: { companyId: string; branchId: string },
  item: PhoneProductInput
) {
  const phoneModel = await tx.phoneModel.findFirst({
    where: { id: item.phoneModelId, companyId: auth.companyId, isActive: true },
    include: { brand: true, platform: true },
  });

  if (!phoneModel) {
    throw new Error("PHONE_MODEL_NOT_FOUND");
  }

  const color = item.color?.trim() || null;
  const storage = item.storage?.trim() || null;
  const ram = item.ram?.trim() || null;
  const deviceCondition = item.deviceCondition || "new";
  const boxCondition =
    deviceCondition === "used" ? item.boxCondition?.trim() || null : null;
  const batteryPercent =
    deviceCondition === "used" && item.batteryPercent != null
      ? Math.min(100, Math.max(0, item.batteryPercent))
      : null;
  let existing = await tx.product.findFirst({
    where: {
      companyId: auth.companyId,
      phoneModelId: phoneModel.id,
      color,
      storage,
      ram,
      deviceCondition,
      deletedAt: null,
    },
  });

  if (!existing && item.barcode?.trim()) {
    existing = await tx.product.findFirst({
      where: {
        companyId: auth.companyId,
        barcode: item.barcode.trim(),
        deletedAt: null,
      },
    });
  }

  const barcode = await ensureUniqueBarcode(
    tx,
    auth.companyId,
    item.barcode,
    phoneModel.nameAr,
    existing?.id
  );

  const warrantyMonths = item.warrantyMonths ?? 12;
  const taxStatus = parseTaxStatus(item.taxStatus);
  const retailPrice =
    item.retailPrice && item.retailPrice > 0
      ? item.retailPrice
      : item.unitPrice > 0
        ? item.unitPrice * 1.15
        : 0;

  const catalogImageUrl = phoneCatalogLogoUrl(phoneModel);
  const imageUrl = existing?.imageUrl?.trim() || catalogImageUrl;

  const productData = {
    type: "phone",
    name: phoneModel.nameAr,
    nameAr: phoneModel.nameAr,
    brand: phoneModel.brand?.nameAr || phoneModel.platform.nameAr,
    phonePlatformId: phoneModel.platformId,
    phoneBrandId: phoneModel.brandId,
    phoneModelId: phoneModel.id,
    color,
    storage,
    ram,
    barcode,
    warrantyMonths,
    taxStatus,
    deviceCondition,
    boxCondition,
    batteryPercent,
    description: item.itemNotes?.trim() || null,
    imageUrl,
    isActive: true,
  };

  if (existing) {
    return tx.product.update({
      where: { id: existing.id },
      data: productData,
    });
  }

  return tx.product.create({
    data: {
      companyId: auth.companyId,
      ...productData,
      inventories: {
        create: {
          branchId: auth.branchId,
          quantity: 0,
          purchasePrice: item.unitPrice,
          retailPrice,
        },
      },
    },
  });
}

export function buildPurchaseItemDescription(
  nameAr: string,
  specs: {
    color?: string;
    storage?: string;
    ram?: string;
    deviceCondition?: string;
    boxCondition?: string | null;
    batteryPercent?: number | null;
  }
) {
  let desc = buildPhoneDescription(nameAr, specs);
  if (specs.deviceCondition === "used") {
    const parts: string[] = ["مستعمل"];
    if (specs.boxCondition === "excellent") parts.push("كارتونة ممتازة");
    else if (specs.boxCondition === "medium") parts.push("كارتونة متوسطة");
    else if (specs.boxCondition === "missing") parts.push("بدون كارتونة");
    if (specs.batteryPercent != null) parts.push(`بطارية ${specs.batteryPercent}%`);
    desc += ` (${parts.join(" — ")})`;
  }
  return desc;
}
