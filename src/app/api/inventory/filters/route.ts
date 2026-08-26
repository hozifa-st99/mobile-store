import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type FilterOption = { id: string; name: string };

export type PhoneCatalogEntryFilter = {
  key: string;
  kind: "brand" | "platform";
  id: string;
  platformId: string;
  brandId?: string;
  name: string;
  models: FilterOption[];
};

function buildPhoneCatalogEntries(
  platforms: Array<{
    id: string;
    nameAr: string;
    requiresBrand: boolean;
    brands: Array<{
      id: string;
      nameAr: string;
      models: Array<{ id: string; nameAr: string }>;
    }>;
    models: Array<{ id: string; nameAr: string }>;
  }>
): PhoneCatalogEntryFilter[] {
  const entries: PhoneCatalogEntryFilter[] = [];

  for (const platform of platforms) {
    if (platform.requiresBrand) {
      for (const brand of platform.brands) {
        entries.push({
          key: `brand-${brand.id}`,
          kind: "brand",
          id: brand.id,
          platformId: platform.id,
          brandId: brand.id,
          name: brand.nameAr,
          models: brand.models.map((model) => ({ id: model.id, name: model.nameAr })),
        });
      }
    } else {
      entries.push({
        key: `platform-${platform.id}`,
        kind: "platform",
        id: platform.id,
        platformId: platform.id,
        name: platform.nameAr,
        models: platform.models.map((model) => ({ id: model.id, name: model.nameAr })),
      });
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const [inventories, phonePlatforms, itemCategories] = await Promise.all([
      prisma.branchInventory.findMany({
        where: {
          branchId: auth.branchId,
          product: {
            deletedAt: null,
            isActive: true,
            companyId: auth.companyId,
          },
        },
        select: { productId: true, product: { select: { brand: true } } },
      }),
      prisma.phonePlatform.findMany({
        where: { companyId: auth.companyId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          brands: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
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
        where: { companyId: auth.companyId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          brands: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              names: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, nameAr: true },
              },
            },
          },
        },
      }),
    ]);

    const productIds = inventories.map((row) => row.productId);
    const productBrands = Array.from(
      new Set(inventories.map((row) => row.product.brand).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "ar"));

    const suppliers =
      productIds.length === 0
        ? []
        : await prisma.supplier.findMany({
            where: {
              companyId: auth.companyId,
              purchases: {
                some: {
                  branchId: auth.branchId,
                  status: "completed",
                  items: { some: { productId: { in: productIds } } },
                },
              },
            },
            select: { id: true, nameAr: true },
            orderBy: { nameAr: "asc" },
          });

    return NextResponse.json({
      filters: {
        productBrands,
        suppliers: suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.nameAr,
        })),
        phoneCatalogEntries: buildPhoneCatalogEntries(phonePlatforms),
        itemCategories: itemCategories.map((category) => ({
          id: category.id,
          name: category.nameAr,
          brands: category.brands.map((brand) => ({
            id: brand.id,
            name: brand.nameAr,
            names: brand.names.map((name) => ({
              id: name.id,
              name: name.nameAr,
            })),
          })),
        })),
      },
    });
  } catch (error) {
    console.error("inventory filters error:", error);
    return NextResponse.json({ message: "تعذر تحميل فلاتر المخزون" }, { status: 500 });
  }
}
