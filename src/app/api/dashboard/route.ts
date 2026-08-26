import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { computeBranchVaultBalance } from "@/lib/branch-vault";
import { computeOpenShiftKpis } from "@/lib/open-shift-kpis";
import { computeOpenShiftHourlyChart } from "@/lib/open-shift-hourly-chart";
import { resolveProductImageUrl } from "@/lib/product-image";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);

    const [
      openShiftKpis,
      branchVaultBalance,
      openShiftHourlyChart,
      customersCount,
      accessoryProductsCount,
      availablePhoneSerials,
      lowStockRow,
      recentSales,
      topProductsRaw,
      chartSales,
      chartSaleReturns,
    ] = await Promise.all([
      computeOpenShiftKpis(auth.branchId),
      computeBranchVaultBalance(prisma, auth.branchId),
      computeOpenShiftHourlyChart(auth.branchId),
      prisma.customer.count({ where: { companyId: auth.companyId, isActive: true } }),
      prisma.branchInventory.count({
        where: {
          branchId: auth.branchId,
          quantity: { gt: 0 },
          product: { type: { not: "phone" } },
        },
      }),
      prisma.productSerial.findMany({
        where: {
          branchId: auth.branchId,
          status: "available",
          product: { type: "phone" },
        },
        select: {
          productId: true,
          purchaseItem: { select: { productId: true } },
          stockEntryItem: { select: { productId: true } },
        },
      }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count
        FROM branch_inventories bi
        INNER JOIN products p ON p.id = bi.product_id
        WHERE bi.branch_id = ${auth.branchId}
          AND bi.quantity > 0
          AND bi.quantity <= bi.min_quantity
          AND p.is_active = 1
          AND p.deleted_at IS NULL
      `,
      prisma.sale.findMany({
        where: { branchId: auth.branchId },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          saleDate: true,
          customer: { select: { nameAr: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.saleItem.groupBy({
        by: ["productId", "description"],
        where: { sale: { branchId: auth.branchId, status: "completed" } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.sale.findMany({
        where: {
          branchId: auth.branchId,
          saleDate: { gte: weekStart },
          status: "completed",
        },
        select: { saleDate: true, total: true },
      }),
      prisma.saleReturn.findMany({
        where: {
          branchId: auth.branchId,
          returnDate: { gte: weekStart },
        },
        select: { returnDate: true, total: true },
      }),
    ]);

    const availablePhoneProductIds = new Set<string>();
    for (const serial of availablePhoneSerials) {
      if (serialBelongsToProduct(serial, serial.productId)) {
        availablePhoneProductIds.add(serial.productId);
      }
    }
    const productsCount = accessoryProductsCount + availablePhoneProductIds.size;

    const lowStockCount = Number(lowStockRow[0]?.count ?? 0);

    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const chartMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      chartMap.set(startOfDay(d).toISOString(), 0);
    }
    for (const s of chartSales) {
      const key = startOfDay(s.saleDate).toISOString();
      if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) || 0) + s.total);
    }
    for (const r of chartSaleReturns) {
      const key = startOfDay(r.returnDate).toISOString();
      if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) || 0) - r.total);
    }
    const salesChart = Array.from(chartMap.entries()).map(([iso, total]) => {
      const d = new Date(iso);
      return { day: dayNames[d.getDay()], sales: Math.round(total * 100) / 100 };
    });

    const productIds = topProductsRaw
      .map((p) => p.productId)
      .filter((id): id is string => Boolean(id));

    const productImages =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds }, companyId: auth.companyId },
            select: {
              id: true,
              imageUrl: true,
              phoneModel: { select: { logoUrl: true } },
              phoneBrand: { select: { logoUrl: true } },
              phonePlatform: { select: { logoUrl: true } },
              itemBrand: { select: { logoUrl: true } },
              itemName: { select: { logoUrl: true } },
              itemCategory: { select: { logoUrl: true } },
            },
          })
        : [];

    const imageByProductId = new Map(
      productImages.map((p) => [p.id, resolveProductImageUrl(p)])
    );

    return NextResponse.json(
      {
        kpis: {
          ...openShiftKpis,
          branchVaultBalance,
          productsCount,
          customersCount,
          lowStockCount,
        },
        recentSales: recentSales.map((s) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          customer: s.customer?.nameAr || "عميل نقدي",
          total: s.total,
          status: s.status,
          date: s.saleDate,
        })),
        topProducts: topProductsRaw.map((p) => ({
          name: p.description,
          quantity: p._sum.quantity || 0,
          revenue: p._sum.total || 0,
          imageUrl: p.productId ? imageByProductId.get(p.productId) ?? null : null,
        })),
        salesChart,
        openShiftHourlyChart,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Dashboard API:", error);
    return NextResponse.json({ message: "خطأ في تحميل البيانات" }, { status: 500 });
  }
}
