import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveReportRange } from "@/lib/report-dates";

type ProductAgg = {
  productId: string;
  name: string;
  barcode: string | null;
  type: string;
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

function mergeAgg(map: Map<string, ProductAgg>, key: string, patch: Partial<ProductAgg> & { deltaQty: number; deltaSales: number; deltaCost: number }) {
  const existing = map.get(key) ?? {
    productId: patch.productId || key,
    name: patch.name || "—",
    barcode: patch.barcode ?? null,
    type: patch.type || "unknown",
    category: patch.category || "غير مصنف",
    quantity: 0,
    sales: 0,
    cost: 0,
  };
  existing.quantity += patch.deltaQty;
  existing.sales += patch.deltaSales;
  existing.cost += patch.deltaCost;
  map.set(key, existing);
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
  const search = searchParams.get("search")?.trim().toLowerCase() || "";
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
  const map = new Map<string, ProductAgg>();

  for (const item of saleItems) {
    const key = item.productId || item.description;
    const unitCost = item.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    mergeAgg(map, key, {
      productId: item.productId || key,
      name: item.product?.nameAr || item.description,
      barcode: item.product?.barcode ?? item.barcode,
      type: item.product?.type || "unknown",
      category: categoryOf(item.product),
      deltaQty: item.quantity,
      deltaSales: item.total,
      deltaCost: item.quantity * unitCost,
    });
  }

  for (const item of returnItems) {
    const key = item.productId || item.description;
    const product = item.saleItem?.product ?? null;
    const unitCost = item.saleItem?.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    mergeAgg(map, key, {
      productId: item.productId || key,
      name: product?.nameAr || item.description,
      barcode: product?.barcode ?? item.barcode,
      type: product?.type || "unknown",
      category: categoryOf(product),
      deltaQty: -item.quantity,
      deltaSales: -item.total,
      deltaCost: -(item.quantity * unitCost),
    });
  }

  let products = Array.from(map.values())
    .map((row) => {
      const profit = Math.round((row.sales - row.cost) * 100) / 100;
      const margin = row.sales > 0 ? Math.round((profit / row.sales) * 1000) / 10 : 0;
      return {
        ...row,
        quantity: row.quantity,
        sales: Math.round(row.sales * 100) / 100,
        cost: Math.round(row.cost * 100) / 100,
        profit,
        margin,
      };
    })
    .filter((row) => row.quantity > 0 || row.sales > 0);

  if (search) {
    products = products.filter(
      (row) =>
        row.name.toLowerCase().includes(search) ||
        (row.barcode && row.barcode.toLowerCase().includes(search))
    );
  }

  products.sort((a, b) => b.sales - a.sales);

  const topByQuantity = [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const topBySales = [...products].sort((a, b) => b.sales - a.sales).slice(0, 5);
  const topByProfit = [...products].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const leastMovement = [...products].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

  return NextResponse.json({
    range,
    highlights: { topByQuantity, topBySales, topByProfit, leastMovement },
    products,
  });
}
