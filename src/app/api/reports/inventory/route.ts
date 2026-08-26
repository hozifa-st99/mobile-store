import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

const STAGNANT_DAYS = 90;

export type InventoryReportFilter = "all" | "low" | "out" | "stagnant";

function productTypeLabel(type: string) {
  return type === "phone" ? "موبايل" : "إكسسوار";
}

function categoryLabel(product: {
  type: string;
  itemCategory?: { nameAr: string } | null;
  phoneModel?: { nameAr: string } | null;
}) {
  if (product.type === "phone") return "موبايلات";
  return product.itemCategory?.nameAr || "إكسسوارات";
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const typeFilter = searchParams.get("type")?.trim() || "";
  const listFilter = (searchParams.get("filter") || "all") as InventoryReportFilter;

  const stagnantSince = new Date();
  stagnantSince.setDate(stagnantSince.getDate() - STAGNANT_DAYS);

  const [inventories, phoneSerialCosts, recentSaleProductIds] = await Promise.all([
    prisma.branchInventory.findMany({
      where: {
        branchId: auth.branchId,
        product: {
          deletedAt: null,
          isActive: true,
          companyId: auth.companyId,
          ...(typeFilter === "phone" || typeFilter === "accessory"
            ? { type: typeFilter }
            : {}),
          ...(search
            ? {
                OR: [
                  { nameAr: { contains: search } },
                  { barcode: { contains: search } },
                  { brand: { contains: search } },
                  { model: { contains: search } },
                ],
              }
            : {}),
        },
      },
      include: {
        product: {
          include: {
            itemCategory: { select: { nameAr: true } },
            phoneModel: { select: { nameAr: true } },
          },
        },
      },
    }),
    prisma.productSerial.findMany({
      where: {
        branchId: auth.branchId,
        status: "available",
        product: { deletedAt: null, isActive: true, type: "phone" },
      },
      select: {
        productId: true,
        unitCost: true,
      },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          branchId: auth.branchId,
          status: "completed",
          saleDate: { gte: stagnantSince },
        },
        productId: { not: null },
      },
      select: { productId: true },
      distinct: ["productId"],
    }),
  ]);

  const serialCostByProduct = new Map<string, { qty: number; value: number }>();
  for (const serial of phoneSerialCosts) {
    const row = serialCostByProduct.get(serial.productId) ?? { qty: 0, value: 0 };
    row.qty += 1;
    row.value += serial.unitCost || 0;
    serialCostByProduct.set(serial.productId, row);
  }

  const recentlySold = new Set(
    recentSaleProductIds.map((row) => row.productId).filter((id): id is string => Boolean(id))
  );

  type ItemRow = {
    productId: string;
    name: string;
    barcode: string | null;
    type: string;
    typeLabel: string;
    category: string;
    quantity: number;
    minQuantity: number;
    unitCost: number;
    stockValue: number;
    status: "available" | "low" | "out" | "stagnant";
  };

  const allItems: ItemRow[] = [];

  for (const inv of inventories) {
    const isPhone = inv.product.type === "phone";
    const serialAgg = serialCostByProduct.get(inv.productId);
    const quantity = isPhone ? (serialAgg?.qty ?? 0) : inv.quantity;
    const unitCost = isPhone
      ? quantity > 0
        ? (serialAgg?.value ?? 0) / quantity
        : inv.purchasePrice
      : inv.purchasePrice;
    const stockValue = isPhone ? (serialAgg?.value ?? 0) : quantity * inv.purchasePrice;

    let status: ItemRow["status"] = "available";
    if (quantity <= 0) status = "out";
    else if (quantity <= inv.minQuantity) status = "low";
    else if (!recentlySold.has(inv.productId)) status = "stagnant";

    allItems.push({
      productId: inv.productId,
      name: inv.product.nameAr,
      barcode: inv.product.barcode,
      type: inv.product.type,
      typeLabel: productTypeLabel(inv.product.type),
      category: categoryLabel(inv.product),
      quantity,
      minQuantity: inv.minQuantity,
      unitCost: Math.round(unitCost * 100) / 100,
      stockValue: Math.round(stockValue * 100) / 100,
      status,
    });
  }

  const summary = {
    stockValue: Math.round(allItems.reduce((sum, item) => sum + item.stockValue, 0) * 100) / 100,
    skuCount: allItems.filter((item) => item.quantity > 0).length,
    unitCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    lowCount: allItems.filter((item) => item.status === "low").length,
    outCount: allItems.filter((item) => item.status === "out").length,
    stagnantCount: allItems.filter((item) => item.status === "stagnant").length,
  };

  const filteredItems =
    listFilter === "all"
      ? allItems
      : listFilter === "low"
        ? allItems.filter((item) => item.status === "low")
        : listFilter === "out"
          ? allItems.filter((item) => item.status === "out")
          : allItems.filter((item) => item.status === "stagnant");

  filteredItems.sort((a, b) => b.stockValue - a.stockValue);

  return NextResponse.json(
    { summary, items: filteredItems },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
