import type { PrismaClient } from "@prisma/client";

import type {
  BranchAvailabilityRow,
  CatalogAvailabilityPayload,
  CatalogLeafAvailability,
} from "@/lib/catalog-availability";
import { sortCatalogEntriesByBrandPriority, sortPhoneCatalogEntries } from "@/lib/catalog-brand-sort";

export type {
  BranchAvailabilityRow,
  CatalogAvailabilityPayload,
  CatalogLeafAvailability,
  ItemCatalogAvailabilityCategory,
  PhoneCatalogAvailabilityModel,
  PhoneCatalogAvailabilityEntry,
} from "@/lib/catalog-availability";

function buildAvailability(
  branchQtyMap: Map<string, number>,
  branches: Array<{ id: string; nameAr: string; code: string | null }>,
  currentBranchId: string
): CatalogLeafAvailability {
  let currentBranchQty = 0;
  const otherBranches: BranchAvailabilityRow[] = [];
  let totalOtherQty = 0;

  for (const branch of branches) {
    const quantity = branchQtyMap.get(branch.id) ?? 0;
    if (quantity <= 0) continue;

    if (branch.id === currentBranchId) {
      currentBranchQty += quantity;
      continue;
    }

    totalOtherQty += quantity;
    otherBranches.push({
      branchId: branch.id,
      branchName: branch.nameAr,
      branchCode: branch.code,
      quantity,
    });
  }

  otherBranches.sort((a, b) => b.quantity - a.quantity || a.branchName.localeCompare(b.branchName, "ar"));

  return {
    currentBranchQty,
    otherBranches,
    totalOtherQty,
    hasAnyStock: currentBranchQty > 0 || totalOtherQty > 0,
  };
}

function buildVariantLabel(
  color: string | null | undefined,
  storage: string | null | undefined,
  ram: string | null | undefined
): string {
  const parts = [color?.trim(), storage?.trim(), ram?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "جهاز";
}

function buildPhoneCatalogEntries(
  platforms: Array<{
    id: string;
    nameAr: string;
    logoUrl: string | null;
    sortOrder: number;
    requiresBrand: boolean;
    brands: Array<{
      id: string;
      nameAr: string;
      logoUrl: string | null;
      sortOrder: number;
      models: Array<{ id: string; nameAr: string }>;
    }>;
    models: Array<{ id: string; nameAr: string }>;
  }>
) {
  const entries: Array<{
    key: string;
    kind: "brand" | "platform";
    name: string;
    logoUrl: string | null;
    sortOrder: number;
    models: Array<{ id: string; nameAr: string }>;
  }> = [];

  for (const platform of platforms) {
    if (platform.requiresBrand) {
      for (const brand of platform.brands) {
        entries.push({
          key: `brand-${brand.id}`,
          kind: "brand",
          name: brand.nameAr,
          logoUrl: brand.logoUrl,
          sortOrder: brand.sortOrder,
          models: brand.models,
        });
      }
    } else {
      entries.push({
        key: `platform-${platform.id}`,
        kind: "platform",
        name: platform.nameAr,
        logoUrl: platform.logoUrl,
        sortOrder: platform.sortOrder,
        models: platform.models,
      });
    }
  }

  return sortPhoneCatalogEntries(entries);
}

export async function loadCatalogAvailability(
  prisma: PrismaClient,
  companyId: string,
  currentBranchId: string
): Promise<CatalogAvailabilityPayload> {
  const [branches, currentBranch, phonePlatforms, itemCategories, phoneProductsList, accessoryProductsList, phoneSerialGroups, inventories] =
    await Promise.all([
      prisma.branch.findMany({
        where: { companyId, isActive: true },
        select: { id: true, nameAr: true, code: true },
        orderBy: { nameAr: "asc" },
      }),
      prisma.branch.findFirst({
        where: { id: currentBranchId, companyId },
        select: { id: true, nameAr: true, code: true },
      }),
      prisma.phonePlatform.findMany({
        where: { companyId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          logoUrl: true,
          sortOrder: true,
          requiresBrand: true,
          brands: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              nameAr: true,
              logoUrl: true,
              sortOrder: true,
              models: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, nameAr: true },
              },
            },
          },
          models: {
            where: { brandId: null, isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, nameAr: true },
          },
        },
      }),
      prisma.itemCategory.findMany({
        where: { companyId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          nameAr: true,
          logoUrl: true,
          brands: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              nameAr: true,
              logoUrl: true,
              sortOrder: true,
              names: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, nameAr: true },
              },
            },
          },
        },
      }),
      prisma.product.findMany({
        where: {
          companyId,
          deletedAt: null,
          isActive: true,
          type: "phone",
          phoneModelId: { not: null },
        },
        select: {
          id: true,
          phoneModelId: true,
          color: true,
          storage: true,
          ram: true,
        },
      }),
      prisma.product.findMany({
        where: {
          companyId,
          deletedAt: null,
          isActive: true,
          type: { not: "phone" },
          itemNameId: { not: null },
        },
        select: { id: true, itemNameId: true },
      }),
      prisma.productSerial.groupBy({
        by: ["branchId", "productId"],
        where: {
          status: "available",
          product: {
            companyId,
            deletedAt: null,
            isActive: true,
            type: "phone",
          },
        },
        _count: { _all: true },
      }),
      prisma.branchInventory.findMany({
        where: {
          quantity: { gt: 0 },
          product: {
            companyId,
            deletedAt: null,
            isActive: true,
            type: { not: "phone" },
          },
        },
        select: { branchId: true, productId: true, quantity: true },
      }),
    ]);

  if (!currentBranch) {
    throw new Error("Branch not found");
  }

  const phoneModelAvailability = new Map<string, Map<string, number>>();
  const productAvailability = new Map<string, Map<string, number>>();
  const itemNameAvailability = new Map<string, Map<string, number>>();

  const phoneProductModelMap = new Map(
    phoneProductsList
      .filter((product) => product.phoneModelId)
      .map((product) => [product.id, product.phoneModelId!])
  );
  const accessoryProducts = new Map(
    accessoryProductsList
      .filter((product) => product.itemNameId)
      .map((product) => [product.id, product.itemNameId!])
  );

  const addQty = (map: Map<string, Map<string, number>>, catalogId: string, branchId: string, qty: number) => {
    if (qty <= 0) return;
    const branchMap = map.get(catalogId) ?? new Map<string, number>();
    branchMap.set(branchId, (branchMap.get(branchId) ?? 0) + qty);
    map.set(catalogId, branchMap);
  };

  for (const row of phoneSerialGroups) {
    const modelId = phoneProductModelMap.get(row.productId);
    if (!modelId) continue;
    addQty(phoneModelAvailability, modelId, row.branchId, row._count._all);
    addQty(productAvailability, row.productId, row.branchId, row._count._all);
  }

  for (const row of inventories) {
    const itemNameId = accessoryProducts.get(row.productId);
    if (!itemNameId) continue;
    addQty(itemNameAvailability, itemNameId, row.branchId, row.quantity);
  }

  const resolveAvailability = (catalogId: string, map: Map<string, Map<string, number>>) =>
    buildAvailability(map.get(catalogId) ?? new Map(), branches, currentBranchId);

  const buildModelVariants = (modelId: string) =>
    phoneProductsList
      .filter((product) => product.phoneModelId === modelId)
      .map((product) => ({
        productId: product.id,
        color: product.color,
        storage: product.storage,
        ram: product.ram,
        label: buildVariantLabel(product.color, product.storage, product.ram),
        availability: resolveAvailability(product.id, productAvailability),
      }))
      .filter((variant) => variant.availability.hasAnyStock)
      .sort(
        (a, b) =>
          b.availability.currentBranchQty +
          b.availability.totalOtherQty -
          (a.availability.currentBranchQty + a.availability.totalOtherQty) ||
          a.label.localeCompare(b.label, "ar")
      );

  const phoneEntries = buildPhoneCatalogEntries(phonePlatforms).map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    name: entry.name,
    logoUrl: entry.logoUrl,
    sortOrder: entry.sortOrder,
    models: entry.models.map((model) => ({
      id: model.id,
      name: model.nameAr,
      variants: buildModelVariants(model.id),
      availability: resolveAvailability(model.id, phoneModelAvailability),
    })),
  }));

  const itemCatalogCategories = itemCategories.map((category) => ({
    id: category.id,
    name: category.nameAr,
    logoUrl: category.logoUrl,
    brands: sortCatalogEntriesByBrandPriority(
      category.brands.map((brand) => ({
        id: brand.id,
        name: brand.nameAr,
        logoUrl: brand.logoUrl,
        sortOrder: brand.sortOrder,
        names: brand.names.map((name) => ({
          id: name.id,
          name: name.nameAr,
          availability: resolveAvailability(name.id, itemNameAvailability),
        })),
      }))
    ),
  }));

  return {
    currentBranch: {
      id: currentBranch.id,
      name: currentBranch.nameAr,
      code: currentBranch.code,
    },
    phoneCatalog: { entries: phoneEntries },
    itemCatalog: { categories: itemCatalogCategories },
  };
}