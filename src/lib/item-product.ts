import type { Prisma } from "@prisma/client";

import { ensureUniqueBarcode } from "@/lib/barcode-server";
import { accessoryCatalogLogoUrl } from "@/lib/product-image";

type Tx = Prisma.TransactionClient;

export interface AccessoryProductInput {
  itemCategoryId?: string | null;
  itemBrandId?: string | null;
  itemNameId?: string | null;
  nameAr: string;
  unitPrice: number;
  retailPrice?: number;
  barcode?: string;
  deviceCondition?: "new" | "used";
  itemNotes?: string | null;
  minQuantity?: number;
}

export async function resolveOrCreateAccessoryProduct(
  tx: Tx,
  auth: { companyId: string; branchId: string },
  item: AccessoryProductInput
) {
  const deviceCondition = item.deviceCondition || "new";
  let nameAr = item.nameAr.trim();
  let itemNameId = item.itemNameId || null;
  let itemNameRecord: { logoUrl: string | null } | null = null;

  if (itemNameId) {
    const catalogName = await tx.itemName.findFirst({
      where: {
        id: itemNameId,
        companyId: auth.companyId,
        isActive: true,
        ...(item.itemBrandId ? { brandId: item.itemBrandId } : {}),
      },
      select: { id: true, nameAr: true, brandId: true, logoUrl: true },
    });
    if (!catalogName) throw new Error("ITEM_NAME_NOT_FOUND");
    nameAr = catalogName.nameAr;
    itemNameId = catalogName.id;
    itemNameRecord = catalogName;
    if (item.itemBrandId && catalogName.brandId !== item.itemBrandId) {
      throw new Error("ITEM_NAME_BRAND_MISMATCH");
    }
  }

  if (!nameAr) throw new Error("ACCESSORY_NAME_REQUIRED");

  let existing = await tx.product.findFirst({
    where: {
      companyId: auth.companyId,
      type: "accessory",
      deviceCondition,
      deletedAt: null,
      ...(itemNameId
        ? { itemNameId }
        : {
            nameAr,
            itemCategoryId: item.itemCategoryId || null,
            itemBrandId: item.itemBrandId || null,
          }),
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

  const barcode = existing?.barcode?.trim()
    ? existing.barcode.trim()
    : await ensureUniqueBarcode(tx, auth.companyId, item.barcode, nameAr, existing?.id);

  const retailPrice =
    item.retailPrice && item.retailPrice > 0
      ? item.retailPrice
      : item.unitPrice > 0
        ? item.unitPrice * 1.15
        : 0;

  let categoryName = "";
  let brandName = "";
  let itemBrandRecord: { logoUrl: string | null } | null = null;
  let itemCategoryRecord: { logoUrl: string | null } | null = null;

  if (item.itemCategoryId) {
    const category = await tx.itemCategory.findFirst({
      where: { id: item.itemCategoryId, companyId: auth.companyId, isActive: true },
      select: { nameAr: true, logoUrl: true },
    });
    if (!category) throw new Error("ITEM_CATEGORY_NOT_FOUND");
    categoryName = category.nameAr;
    itemCategoryRecord = category;
  }

  if (item.itemBrandId) {
    const brand = await tx.itemBrand.findFirst({
      where: {
        id: item.itemBrandId,
        companyId: auth.companyId,
        isActive: true,
        ...(item.itemCategoryId ? { categoryId: item.itemCategoryId } : {}),
      },
      select: { nameAr: true, logoUrl: true },
    });
    if (!brand) throw new Error("ITEM_BRAND_NOT_FOUND");
    brandName = brand.nameAr;
    itemBrandRecord = brand;
  }

  const catalogImageUrl = accessoryCatalogLogoUrl(
    itemNameRecord,
    itemBrandRecord,
    itemCategoryRecord
  );
  const imageUrl = existing?.imageUrl?.trim() || catalogImageUrl;

  const productData = {
    type: "accessory",
    name: nameAr,
    nameAr,
    brand: brandName || categoryName || "—",
    itemCategoryId: item.itemCategoryId || null,
    itemBrandId: item.itemBrandId || null,
    itemNameId,
    barcode,
    deviceCondition,
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
          minQuantity: item.minQuantity ?? 5,
          purchasePrice: item.unitPrice,
          retailPrice,
        },
      },
    },
  });
}

export function buildAccessoryPurchaseDescription(
  nameAr: string,
  categoryName?: string,
  brandName?: string
) {
  const parts = [categoryName, brandName, nameAr].filter(Boolean);
  return parts.join(" — ");
}
