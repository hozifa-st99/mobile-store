import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { formatDeviceImeisLabel, getDeviceImeis } from "@/lib/product-serial-imeis";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";
import {
  getSerialEffectiveRetailPrice,
  summarizePriceRange,
} from "@/lib/phone-serial-pricing";

function buildProductWhere(
  auth: { branchId: string; companyId: string },
  params: {
    search: string;
    type: string;
    brand: string;
    supplierId: string;
    phoneBrandId: string;
    phonePlatformId: string;
    phoneModelId: string;
    itemCategoryId: string;
    itemBrandId: string;
    itemNameId: string;
    deviceCondition: string;
  }
) {
  const productWhere: Record<string, unknown> = {
    deletedAt: null,
    isActive: true,
    companyId: auth.companyId,
  };

  if (params.search) {
    productWhere.OR = [
      { nameAr: { contains: params.search } },
      { brand: { contains: params.search } },
      { barcode: { contains: params.search } },
      { model: { contains: params.search } },
      {
        serials: {
          some: {
            branchId: auth.branchId,
            OR: [
              { imeiEntries: { some: { imei: { contains: params.search } } } },
              { barcode: { contains: params.search } },
              { serialNumber: { contains: params.search } },
            ],
          },
        },
      },
    ];
  }

  if (params.type) productWhere.type = params.type;
  if (params.brand) productWhere.brand = params.brand;
  if (params.deviceCondition === "new" || params.deviceCondition === "used") {
    productWhere.deviceCondition = params.deviceCondition;
  }
  if (params.phoneBrandId) productWhere.phoneBrandId = params.phoneBrandId;
  if (params.phonePlatformId) productWhere.phonePlatformId = params.phonePlatformId;
  if (params.phoneModelId) productWhere.phoneModelId = params.phoneModelId;
  if (params.itemCategoryId) productWhere.itemCategoryId = params.itemCategoryId;
  if (params.itemBrandId) productWhere.itemBrandId = params.itemBrandId;
  if (params.itemNameId) productWhere.itemNameId = params.itemNameId;

  if (params.supplierId) {
    productWhere.purchaseItems = {
      some: {
        purchase: {
          branchId: auth.branchId,
          supplierId: params.supplierId,
          status: "completed",
        },
      },
    };
  }

  return productWhere;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const params = {
    search: searchParams.get("search")?.trim() || "",
    type: searchParams.get("type")?.trim() || "",
    brand: searchParams.get("brand")?.trim() || "",
    supplierId: searchParams.get("supplierId")?.trim() || "",
    phoneBrandId: searchParams.get("phoneBrandId")?.trim() || "",
    phonePlatformId: searchParams.get("phonePlatformId")?.trim() || "",
    phoneModelId: searchParams.get("phoneModelId")?.trim() || "",
    itemCategoryId: searchParams.get("itemCategoryId")?.trim() || "",
    itemBrandId: searchParams.get("itemBrandId")?.trim() || "",
    itemNameId: searchParams.get("itemNameId")?.trim() || "",
    deviceCondition: searchParams.get("deviceCondition")?.trim() || "",
  };
  const status = searchParams.get("status") || "";

  const productWhere = buildProductWhere(auth, params);

  const inventories = await prisma.branchInventory.findMany({
    where: {
      branchId: auth.branchId,
      product: productWhere,
    },
    include: {
      product: {
        include: {
          phoneBrand: { select: { nameAr: true } },
          phoneModel: { select: { nameAr: true } },
          itemCategory: { select: { nameAr: true } },
          itemBrand: { select: { nameAr: true } },
          itemName: { select: { nameAr: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filteredProductIds = inventories.map((inv) => inv.productId);

  const hasActiveFilters =
    !!params.search ||
    !!params.type ||
    !!params.brand ||
    !!params.supplierId ||
    !!params.phoneBrandId ||
    !!params.phonePlatformId ||
    !!params.phoneModelId ||
    !!params.itemCategoryId ||
    !!params.itemBrandId ||
    !!params.itemNameId ||
    !!params.deviceCondition;

  const serialWhere: Record<string, unknown> = {
    branchId: auth.branchId,
    ...(status && { status }),
  };

  if (filteredProductIds.length > 0) {
    serialWhere.productId = { in: filteredProductIds };
  } else if (hasActiveFilters) {
    serialWhere.productId = { in: [] };
  }

  if (params.search) {
    serialWhere.AND = [
      ...(Array.isArray(serialWhere.AND) ? serialWhere.AND : []),
      {
        OR: [
          { imeiEntries: { some: { imei: { contains: params.search } } } },
          { barcode: { contains: params.search } },
          { serialNumber: { contains: params.search } },
          {
            product: {
              OR: [
                { nameAr: { contains: params.search } },
                { brand: { contains: params.search } },
                { barcode: { contains: params.search } },
                { model: { contains: params.search } },
              ],
            },
          },
        ],
      },
    ];
  }

  const serialRows = await prisma.productSerial.findMany({
    where: serialWhere,
    include: {
      product: true,
      imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serials = serialRows.map((serial) => {
    const imeis = getDeviceImeis(serial);
    const imei = imeis.length > 0 ? formatDeviceImeisLabel(imeis) : null;
    return { ...serial, imei };
  });

  const phoneInventories = inventories.filter((inv) => inv.product.type === "phone");
  const phoneProductIds = phoneInventories.map((inv) => inv.productId);

  const phoneSerialRows =
    phoneProductIds.length > 0
      ? await prisma.productSerial.findMany({
          where: {
            branchId: auth.branchId,
            productId: { in: phoneProductIds },
            status: "available",
          },
          select: {
            productId: true,
            unitCost: true,
            retailPrice: true,
            purchaseItem: { select: { retailPrice: true, productId: true } },
            stockEntryItem: { select: { retailPrice: true, productId: true } },
          },
        })
      : [];

  const serialsByProduct = new Map<string, typeof phoneSerialRows>();
  for (const serial of phoneSerialRows) {
    if (!serialBelongsToProduct(serial, serial.productId)) continue;
    const list = serialsByProduct.get(serial.productId) ?? [];
    list.push(serial);
    serialsByProduct.set(serial.productId, list);
  }

  const serialCountByProduct = new Map<string, number>();
  serialsByProduct.forEach((serials, productId) => {
    serialCountByProduct.set(productId, serials.length);
  });

  for (const inv of phoneInventories) {
    const availableCount = serialCountByProduct.get(inv.productId) ?? 0;
    if (availableCount !== inv.quantity) {
      await prisma.branchInventory.update({
        where: { id: inv.id },
        data: { quantity: availableCount },
      });
      inv.quantity = availableCount;
    }
  }

  const items = inventories.map((inv) => {
    const isPhone = inv.product.type === "phone";
    const quantity = isPhone
      ? (serialCountByProduct.get(inv.productId) ?? inv.quantity)
      : inv.quantity;

    let retailPrice = inv.retailPrice;
    let retailPriceRange: ReturnType<typeof summarizePriceRange> = null;

    if (isPhone) {
      const serials = serialsByProduct.get(inv.productId) ?? [];
      if (serials.length > 0) {
        retailPriceRange = summarizePriceRange(
          serials.map((serial) =>
            getSerialEffectiveRetailPrice(
              {
                unitCost: serial.unitCost,
                retailPrice: serial.retailPrice,
                purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
                stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
              },
              inv.retailPrice
            )
          )
        );
        if (retailPriceRange?.single) retailPrice = retailPriceRange.min;
      }
    }

    return {
      id: inv.id,
      productId: inv.productId,
      name: inv.product.nameAr,
      brand: inv.product.brand,
      model: inv.product.model,
      type: inv.product.type,
      barcode: inv.product.barcode,
      storage: inv.product.storage,
      color: inv.product.color,
      ram: inv.product.ram,
      imageUrl: inv.product.imageUrl,
      phoneBrandName: inv.product.phoneBrand?.nameAr || null,
      phoneModelName: inv.product.phoneModel?.nameAr || null,
      itemCategoryName: inv.product.itemCategory?.nameAr || null,
      itemBrandName: inv.product.itemBrand?.nameAr || null,
      itemNameLabel: inv.product.itemName?.nameAr || null,
      quantity,
      minQuantity: inv.minQuantity,
      purchasePrice: inv.purchasePrice,
      retailPrice,
      retailPriceRange,
      deviceCondition: inv.product.deviceCondition,
      phonePlatformId: inv.product.phonePlatformId,
      phoneBrandId: inv.product.phoneBrandId,
      status:
        quantity === 0
          ? "out"
          : quantity <= inv.minQuantity
            ? "low"
            : "available",
    };
  });

  return NextResponse.json({ items, serials });
}
