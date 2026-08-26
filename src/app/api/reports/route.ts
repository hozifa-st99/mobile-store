import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { bucketDate, buildChartBuckets, resolveReportRange } from "@/lib/report-dates";
import {
  computeActualCash,
  netPurchasesTotal,
  sumCogsForSaleReturnIds,
  sumCogsInRange,
  sumExpensesInRange,
  sumPurchaseReturnCashBreakdownInRange,
  sumSaleReturnsInRange,
} from "@/lib/dashboard-metrics";

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};

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

  const [
    sales,
    purchases,
    expenses,
    maintenance,
    customers,
    suppliers,
    inventory,
    salesList,
    expensesByCategory,
    salesByPayment,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        branchId: auth.branchId,
        saleDate: { gte: from, lte: to },
        status: "completed",
      },
      _sum: { total: true, subtotal: true, discount: true },
      _count: true,
      _avg: { total: true },
    }),
    prisma.purchase.aggregate({
      where: {
        branchId: auth.branchId,
        purchaseDate: { gte: from, lte: to },
        status: "completed",
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { branchId: auth.branchId, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.maintenanceOrder.aggregate({
      where: { branchId: auth.branchId, receivedDate: { gte: from, lte: to } },
      _sum: { cost: true, paidAmount: true },
      _count: true,
    }),
    prisma.customer.count({ where: { companyId: auth.companyId, isActive: true } }),
    prisma.supplier.count({ where: { companyId: auth.companyId, isActive: true } }),
    prisma.branchInventory.aggregate({
      where: { branchId: auth.branchId },
      _sum: { quantity: true },
    }),
    prisma.sale.findMany({
      where: {
        branchId: auth.branchId,
        saleDate: { gte: from, lte: to },
        status: "completed",
      },
      select: { saleDate: true, total: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { branchId: auth.branchId, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: {
        branchId: auth.branchId,
        saleDate: { gte: from, lte: to },
        status: "completed",
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const salesGrossTotal = sales._sum.total || 0;
  const purchasesGrossTotal = purchases._sum.total || 0;
  const purchaseReturnsBreakdown = await sumPurchaseReturnCashBreakdownInRange(
    prisma,
    auth.branchId,
    from,
    to
  );
  const purchaseReturnsTotal = purchaseReturnsBreakdown.total;
  const saleReturnsInRange = await prisma.saleReturn.findMany({
    where: {
      branchId: auth.branchId,
      returnDate: { gte: from, lte: to },
    },
    select: { id: true, returnDate: true, total: true },
  });
  const saleReturnIds = saleReturnsInRange.map((row) => row.id);
  const saleReturnsCount = saleReturnsInRange.length;
  const saleReturnsTotal = await sumSaleReturnsInRange(prisma, auth.branchId, from, to);
  const purchaseReturnsCount = await prisma.purchaseReturn.count({
    where: {
      branchId: auth.branchId,
      returnDate: { gte: from, lte: to },
    },
  });
  const salesNetTotal = Math.round((salesGrossTotal - saleReturnsTotal) * 100) / 100;
  const purchasesNetTotal = netPurchasesTotal(purchasesGrossTotal, purchaseReturnsTotal);
  const [cogsGrossTotal, returnCogsTotal, expensesTotal, expensesForCash] = await Promise.all([
    sumCogsInRange(prisma, auth.branchId, from, to),
    sumCogsForSaleReturnIds(prisma, auth.branchId, saleReturnIds),
    sumExpensesInRange(prisma, auth.branchId, from, to, { includeReturnLinked: true }),
    sumExpensesInRange(prisma, auth.branchId, from, to),
  ]);
  const cogsTotal = Math.round((cogsGrossTotal - returnCogsTotal) * 100) / 100;
  const profit = Math.round((salesNetTotal - cogsTotal - expensesTotal) * 100) / 100;
  const profitMargin =
    salesNetTotal > 0 ? Math.round((profit / salesNetTotal) * 100) : 0;
  const cashFlow = salesNetTotal - expensesForCash;
  const actualCash = computeActualCash({
    salesTotal: salesGrossTotal,
    expensesTotal,
    purchasesGross: purchasesGrossTotal,
    purchaseReturnsTotal: purchaseReturnsBreakdown.total,
    saleReturnsTotal,
  });

  const buckets = buildChartBuckets(range.from, range.to);
  const salesMap = new Map(buckets.map((b) => [b.key, 0]));
  for (const s of salesList) {
    const key = bucketDate(s.saleDate, range.from, range.to);
    if (salesMap.has(key)) salesMap.set(key, (salesMap.get(key) || 0) + s.total);
  }
  for (const saleReturn of saleReturnsInRange) {
    const key = bucketDate(saleReturn.returnDate, range.from, range.to);
    if (salesMap.has(key)) salesMap.set(key, (salesMap.get(key) || 0) - saleReturn.total);
  }
  const salesChart = buckets.map((b) => ({
    label: b.label,
    sales: Math.round((salesMap.get(b.key) || 0) * 100) / 100,
  }));

  const comparisonChart = [
    { name: "مبيعات", value: Math.round(salesNetTotal), fill: "#10b981" },
    { name: "مشتريات", value: Math.round(purchasesNetTotal), fill: "#6366f1" },
    { name: "مصروفات", value: Math.round(expensesTotal), fill: "#f59e0b" },
  ];

  const expenseChart = expensesByCategory.map((e) => ({
    name: e.category,
    value: Math.round(e._sum.amount || 0),
  }));

  return NextResponse.json(
    {
      range,
      summary: {
        salesTotal: salesNetTotal,
        salesGrossTotal,
        salesNetTotal,
        salesCount: sales._count,
        salesAvg: Math.round(sales._avg.total || 0),
        salesDiscount: sales._sum.discount || 0,
        purchasesTotal: purchasesNetTotal,
        purchasesGrossTotal,
        purchasesNetTotal,
        purchaseReturnsTotal,
        purchaseReturnSubtotal: purchaseReturnsBreakdown.subtotal,
        purchaseExpenseRecovered: purchaseReturnsBreakdown.expenseRecovered,
        saleReturnsTotal,
        saleReturnsCount,
        purchaseReturnsCount,
        purchasesCount: purchases._count,
        expensesTotal,
        expensesCount: expenses._count,
        cogsTotal,
        cogsGrossTotal,
        returnCogsTotal,
        maintenanceRevenue: maintenance._sum.paidAmount || 0,
        maintenanceCost: maintenance._sum.cost || 0,
        maintenanceCount: maintenance._count,
        profit,
        profitMargin,
        cashFlow,
        actualCash,
        customersCount: customers,
        suppliersCount: suppliers,
        stockUnits: inventory._sum.quantity || 0,
      },
      salesByPayment: salesByPayment.map((p) => ({
        method: p.paymentMethod,
        label: paymentLabels[p.paymentMethod] || p.paymentMethod,
        total: p._sum.total || 0,
        count: p._count,
      })),
      expensesByCategory: expensesByCategory.map((e) => ({
        category: e.category,
        amount: e._sum.amount || 0,
      })),
      salesChart,
      comparisonChart,
      expenseChart,
    },
    {
      headers: { "Cache-Control": "private, max-age=15" },
    }
  );
}
