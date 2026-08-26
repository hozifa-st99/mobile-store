import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveReportRange } from "@/lib/report-dates";

type CategoryAgg = {
  category: string;
  quantity: number;
  sales: number;
  cost: number;
};

function categoryOf(product: {
  type: string;
  itemCategory?: { nameAr: string } | null;
} | null) {
  if (!product) return "غير مصنف";
  if (product.type === "phone") return "موبايلات";
  return product.itemCategory?.nameAr || "إكسسوارات";
}

function bump(map: Map<string, CategoryAgg>, category: string, qty: number, sales: number, cost: number) {
  const row = map.get(category) ?? { category, quantity: 0, sales: 0, cost: 0 };
  row.quantity += qty;
  row.sales += sales;
  row.cost += cost;
  map.set(category, row);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const range = resolveReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });
  const from = new Date(range.from);
  const to = new Date(range.to);
  const typeFilter = searchParams.get("type")?.trim() || "";

  const productTypeWhere =
    typeFilter === "phone" || typeFilter === "accessory" ? { type: typeFilter } : undefined;

  const [saleItems, returnItems, purchasePrices] = await Promise.all([
    prisma.saleItem.findMany({
      where: {
        sale: {
          branchId: auth.branchId,
          status: "completed",
          saleDate: { gte: from, lte: to },
        },
        ...(productTypeWhere ? { product: productTypeWhere } : {}),
      },
      include: {
        product: { include: { itemCategory: { select: { nameAr: true } } } },
      },
    }),
    prisma.saleReturnItem.findMany({
      where: {
        saleReturn: {
          branchId: auth.branchId,
          returnDate: { gte: from, lte: to },
        },
        ...(productTypeWhere ? { saleItem: { product: productTypeWhere } } : {}),
      },
      include: {
        saleItem: {
          select: {
            unitCost: true,
            product: { include: { itemCategory: { select: { nameAr: true } } } },
          },
        },
      },
    }),
    prisma.branchInventory.findMany({
      where: { branchId: auth.branchId },
      select: { productId: true, purchasePrice: true },
    }),
  ]);

  const priceByProduct = new Map(purchasePrices.map((row) => [row.productId, row.purchasePrice]));
  const map = new Map<string, CategoryAgg>();

  for (const item of saleItems) {
    const cat = categoryOf(item.product);
    const unitCost = item.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    bump(map, cat, item.quantity, item.total, item.quantity * unitCost);
  }

  for (const item of returnItems) {
    const cat = categoryOf(item.saleItem?.product ?? null);
    const unitCost = item.saleItem?.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    bump(map, cat, -item.quantity, -item.total, -(item.quantity * unitCost));
  }

  const totalSales = Array.from(map.values()).reduce((sum, row) => sum + row.sales, 0);

  const categories = Array.from(map.values())
    .map((row) => {
      const profit = Math.round((row.sales - row.cost) * 100) / 100;
      const share = totalSales > 0 ? Math.round((row.sales / totalSales) * 1000) / 10 : 0;
      return {
        category: row.category,
        quantity: row.quantity,
        sales: Math.round(row.sales * 100) / 100,
        cost: Math.round(row.cost * 100) / 100,
        profit,
        share,
      };
    })
    .filter((row) => row.quantity > 0 || row.sales > 0)
    .sort((a, b) => b.sales - a.sales);

  return NextResponse.json({ range, totalSales: Math.round(totalSales * 100) / 100, categories });
}
