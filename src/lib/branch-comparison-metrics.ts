import { prisma } from "@/lib/prisma";
import {
  bucketDate,
  buildChartBuckets,
  endOfDay,
  inclusivePeriodDays,
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
} from "@/lib/report-dates";
import {
  computeActualCash,
  netPurchasesTotal,
  sumCogsForSaleIds,
  sumCogsForSaleReturnIds,
  sumPurchaseReturnCashBreakdownInRange,
  sumSaleReturnsInRange,
} from "@/lib/dashboard-metrics";
import {
  computeSavedStocktakeItemAdjustmentAmount,
  sumSavedStocktakeItemAdjustmentAmount,
} from "@/lib/stocktake-saved-adjustment";

type Db = typeof prisma;

export interface BranchSummaryMetrics {
  salesGrossTotal: number;
  salesNetTotal: number;
  salesCount: number;
  salesAvg: number;
  salesDiscount: number;
  saleReturnsTotal: number;
  saleReturnsCount: number;
  saleReturnsRate: number;
  purchasesGrossTotal: number;
  purchasesNetTotal: number;
  purchasesCount: number;
  purchaseReturnsTotal: number;
  purchaseReturnsCount: number;
  cogsTotal: number;
  grossProfit: number;
  grossProfitMargin: number;
  expensesTotal: number;
  expensesCount: number;
  expensesToSalesRatio: number;
  profit: number;
  profitMargin: number;
  actualCash: number;
  customersInSales: number;
}

export interface BranchInventoryItem {
  productId: string;
  name: string;
  barcode: string | null;
  typeLabel: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  stockValue: number;
  status: "out" | "low" | "stagnant" | "fast";
}

export interface BranchInventoryMetrics {
  stockValue: number;
  unitCount: number;
  skuCount: number;
  phoneStockValue: number;
  accessoryStockValue: number;
  lowCount: number;
  outCount: number;
  stagnantCount: number;
  fastMovingCount: number;
  /** تكلفة البضاعة ÷ قيمة المخzون الحالية */
  currentStockMovementRate: number;
  /** متوسط قيمة المخzون = (افتتاحي + ختامي) ÷ 2 */
  avgStockValue: number;
  /** تكلفة البضاعة ÷ متوسط قيمة المخzون */
  inventoryTurnoverRate: number;
  avgDaysInStock: number | null;
  inventoryEfficiency: number;
  items: BranchInventoryItem[];
}

export interface BranchStocktakeMetrics {
  count: number;
  surplusValue: number;
  shortageValue: number;
  netAdjustment: number;
  itemsWithVariance: number;
  missingImeiCount: number;
  phoneShortageValue: number;
  accessoryShortageValue: number;
}

export interface BranchProductHighlight {
  productId: string;
  name: string;
  quantity: number;
  sales: number;
  profit: number;
}

export interface BranchPhoneBrandMetric {
  brand: string;
  count: number;
  amount: number;
}

export interface BranchPhoneMetrics {
  soldCount: number;
  soldAmount: number;
  returnedCount: number;
  returnedAmount: number;
  netSoldCount: number;
  netSoldAmount: number;
  soldByBrand: BranchPhoneBrandMetric[];
  availableCount: number;
  usedStockCount: number;
  phoneStockValue: number;
  phoneStockCost: number;
  /** إجمالي مبيعات الموبايلات قبل المرتجع */
  phoneSales: number;
  /** صافي ربح الموبaيلات بعد المرتجع */
  phoneProfit: number;
  /** أجهزة مباعة بدورة مستعملة (cycleIndex > 1) خلال الفترة */
  usedCount: number;
}

export interface BranchEmployeeMetrics {
  employeeCount: number;
  salesTotal: number;
  salesPerEmployee: number;
}

export interface BranchExpenseRow {
  category: string;
  amount: number;
}

export interface BranchTimePoint {
  label: string;
  sales: number;
}

export interface BranchComparisonRow {
  branchId: string;
  branchName: string;
  branchCode: string | null;
  summary: BranchSummaryMetrics;
  inventory: BranchInventoryMetrics;
  stocktake: BranchStocktakeMetrics;
  phones: BranchPhoneMetrics;
  employees: BranchEmployeeMetrics;
  expensesByCategory: BranchExpenseRow[];
  topByQuantity: BranchProductHighlight[];
  topBySales: BranchProductHighlight[];
  topByProfit: BranchProductHighlight[];
  stagnantProducts: BranchProductHighlight[];
  timeSeries: BranchTimePoint[];
}

const STAGNANT_DAYS = 90;

/** فترة التقرير — الشهر الحالي من 1 الشهر حتى اليوم (عرض مقارنة الفروع فقط) */
export function resolveBranchComparisonReportRange(params: {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  month?: string | null;
}): ReportDateRange {
  const monthParam = params.month;
  const hasExplicitRange = Boolean(params.from && params.to);

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam) && !hasExplicitRange) {
    const [y, m] = monthParam.split("-").map(Number);
    const from = startOfDay(new Date(y, m - 1, 1));
    const now = new Date();
    const isCurrentMonth = y === now.getFullYear() && m - 1 === now.getMonth();
    const to = isCurrentMonth ? endOfDay(now) : endOfDay(new Date(y, m, 0));
    const monthLabel = from.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
    const label = isCurrentMonth
      ? `${monthLabel} — حتى ${now.toLocaleDateString("ar-EG")}`
      : monthLabel;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label,
    };
  }

  return resolveReportRange(params);
}

function productTypeLabel(type: string) {
  return type === "phone" ? "موبايل" : "إكسسوار";
}

function inventoryCategoryLabel(product: {
  type: string;
  itemCategory?: { nameAr: string } | null;
}) {
  if (product.type === "phone") return "موبايلات";
  return product.itemCategory?.nameAr || "إكسسوارات";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function computeBranchComparisonRow(
  db: Db,
  branchId: string,
  branchName: string,
  branchCode: string | null,
  companyId: string,
  from: Date,
  to: Date
): Promise<BranchComparisonRow> {
  const [
    sales,
    purchases,
    expenses,
    saleReturnsInRange,
    purchaseReturnsBreakdown,
    purchaseReturnsCount,
    expensesForRatioAgg,
    customersInSales,
    inventories,
    phoneSerialCosts,
    recentSaleProductIds,
    stocktakes,
    saleItems,
    returnItems,
    purchasePrices,
    phoneSalesItems,
    phoneReturnItems,
    availablePhones,
    usedPhonesSold,
    usedPhonesInStock,
    branchEmployees,
    employeeSales,
    expensesByCategory,
    salesList,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { branchId, saleDate: { gte: from, lte: to }, status: "completed" },
      _sum: { total: true, discount: true },
      _count: true,
      _avg: { total: true },
    }),
    db.purchase.aggregate({
      where: { branchId, purchaseDate: { gte: from, lte: to }, status: "completed" },
      _sum: { total: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { branchId, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
    }),
    db.saleReturn.findMany({
      where: { branchId, returnDate: { gte: from, lte: to } },
      select: { id: true, returnDate: true, total: true },
    }),
    sumPurchaseReturnCashBreakdownInRange(db, branchId, from, to),
    db.purchaseReturn.count({ where: { branchId, returnDate: { gte: from, lte: to } } }),
    db.expense.aggregate({
      where: {
        branchId,
        expenseDate: { gte: from, lte: to },
        purchaseReturnId: null,
      },
      _sum: { amount: true },
    }),
    db.sale.findMany({
      where: {
        branchId,
        saleDate: { gte: from, lte: to },
        status: "completed",
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    db.branchInventory.findMany({
      where: {
        branchId,
        product: { deletedAt: null, isActive: true, companyId },
      },
      include: {
        product: {
          include: { itemCategory: { select: { nameAr: true } } },
        },
      },
    }),
    db.productSerial.findMany({
      where: {
        branchId,
        status: "available",
        product: { deletedAt: null, isActive: true, type: "phone" },
      },
      select: { productId: true, unitCost: true },
    }),
    db.saleItem.findMany({
      where: {
        sale: { branchId, status: "completed", saleDate: { gte: new Date(Date.now() - STAGNANT_DAYS * 86400000) } },
        productId: { not: null },
      },
      select: { productId: true },
      distinct: ["productId"],
    }),
    db.stocktake.findMany({
      where: {
        branchId,
        status: "completed",
        stocktakeDate: { gte: from, lte: to },
      },
      include: {
        items: {
          include: {
            product: { select: { type: true } },
          },
        },
      },
    }),
    db.saleItem.findMany({
      where: {
        sale: { branchId, status: "completed", saleDate: { gte: from, lte: to } },
      },
      include: {
        product: { include: { itemCategory: { select: { nameAr: true } } } },
      },
    }),
    db.saleReturnItem.findMany({
      where: {
        saleReturn: { branchId, returnDate: { gte: from, lte: to } },
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
    db.branchInventory.findMany({
      where: { branchId },
      select: { productId: true, purchasePrice: true },
    }),
    db.saleItem.findMany({
      where: {
        sale: { branchId, status: "completed", saleDate: { gte: from, lte: to } },
        product: { type: "phone" },
      },
      include: { product: { select: { brand: true, nameAr: true } } },
    }),
    db.saleReturnItem.findMany({
      where: {
        saleReturn: { branchId, returnDate: { gte: from, lte: to } },
        saleItem: { product: { type: "phone" } },
      },
      select: {
        quantity: true,
        total: true,
        saleItem: {
          select: {
            unitCost: true,
            product: { select: { brand: true } },
          },
        },
      },
    }),
    db.productSerial.findMany({
      where: {
        branchId,
        status: "available",
        product: { type: "phone", deletedAt: null, isActive: true },
      },
      select: { unitCost: true },
    }),
    db.saleItem.count({
      where: {
        sale: { branchId, status: "completed", saleDate: { gte: from, lte: to } },
        serial: { cycleIndex: { gt: 1 } },
      },
    }),
    db.productSerial.count({
      where: {
        branchId,
        status: "available",
        product: {
          type: "phone",
          deletedAt: null,
          isActive: true,
          companyId,
          deviceCondition: "used",
        },
      },
    }),
    db.branchEmployee.findMany({
      where: { branchId, isActive: true },
      select: { id: true },
    }),
    db.sale.findMany({
      where: {
        branchId,
        status: "completed",
        branchEmployeeId: { not: null },
        saleDate: { gte: from, lte: to },
      },
      select: { branchEmployeeId: true, total: true },
    }),
    db.expense.groupBy({
      by: ["category"],
      where: { branchId, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    db.sale.findMany({
      where: { branchId, saleDate: { gte: from, lte: to }, status: "completed" },
      select: { id: true, saleDate: true, total: true },
    }),
  ]);

  const saleReturnIds = saleReturnsInRange.map((row) => row.id);
  const expensesTotal = Number(expenses._sum.amount || 0);
  const expensesForRatio = Number(expensesForRatioAgg._sum.amount || 0);
  const [saleReturnsTotal, returnCogsTotal, cogsGrossTotal] = await Promise.all([
    sumSaleReturnsInRange(db, branchId, from, to),
    sumCogsForSaleReturnIds(db, branchId, saleReturnIds),
    sumCogsForSaleIds(
      db,
      branchId,
      salesList.map((sale) => sale.id)
    ),
  ]);

  const salesGrossTotal = sales._sum.total || 0;
  const salesNetTotal = roundMoney(salesGrossTotal - saleReturnsTotal);
  const purchasesGrossTotal = purchases._sum.total || 0;
  const purchasesNetTotal = netPurchasesTotal(purchasesGrossTotal, purchaseReturnsBreakdown.total);
  const cogsTotal = roundMoney(cogsGrossTotal - returnCogsTotal);
  const grossProfit = roundMoney(salesNetTotal - cogsTotal);
  const grossProfitMargin = salesNetTotal > 0 ? Math.round((grossProfit / salesNetTotal) * 100) : 0;
  const profit = roundMoney(salesNetTotal - cogsTotal - expensesTotal);
  const profitMargin = salesNetTotal > 0 ? Math.round((profit / salesNetTotal) * 100) : 0;
  const saleReturnsRate =
    salesGrossTotal > 0 ? Math.round((saleReturnsTotal / salesGrossTotal) * 1000) / 10 : 0;
  const expensesToSalesRatio =
    salesNetTotal > 0 ? Math.round((expensesTotal / salesNetTotal) * 1000) / 10 : 0;

  const summary: BranchSummaryMetrics = {
    salesGrossTotal: roundMoney(salesGrossTotal),
    salesNetTotal,
    salesCount: sales._count,
    salesAvg: Math.round(sales._avg.total || 0),
    salesDiscount: sales._sum.discount || 0,
    saleReturnsTotal: roundMoney(saleReturnsTotal),
    saleReturnsCount: saleReturnsInRange.length,
    saleReturnsRate,
    purchasesGrossTotal: roundMoney(purchasesGrossTotal),
    purchasesNetTotal: roundMoney(purchasesNetTotal),
    purchasesCount: purchases._count,
    purchaseReturnsTotal: roundMoney(purchaseReturnsBreakdown.total),
    purchaseReturnsCount,
    cogsTotal,
    grossProfit,
    grossProfitMargin,
    expensesTotal: roundMoney(expensesTotal),
    expensesCount: expenses._count,
    expensesToSalesRatio,
    profit,
    profitMargin,
    actualCash: computeActualCash({
      salesTotal: salesGrossTotal,
      expensesTotal: expensesForRatio,
      purchasesGross: purchasesGrossTotal,
      purchaseReturnsTotal: purchaseReturnsBreakdown.total,
      saleReturnsTotal,
    }),
    customersInSales: customersInSales.length,
  };

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

  let stockValue = 0;
  let unitCount = 0;
  let skuCount = 0;
  let phoneStockValue = 0;
  let accessoryStockValue = 0;
  let lowCount = 0;
  let outCount = 0;
  let stagnantCount = 0;
  let fastMovingCount = 0;
  const inventoryItems: BranchInventoryItem[] = [];

  for (const inv of inventories) {
    const isPhone = inv.product.type === "phone";
    const serialAgg = serialCostByProduct.get(inv.productId);
    const quantity = isPhone ? (serialAgg?.qty ?? 0) : inv.quantity;
    const unitCost = isPhone
      ? quantity > 0
        ? (serialAgg?.value ?? 0) / quantity
        : inv.purchasePrice
      : inv.purchasePrice;
    const value = isPhone ? (serialAgg?.value ?? 0) : quantity * inv.purchasePrice;

    let status: BranchInventoryItem["status"];
    if (quantity <= 0) {
      outCount += 1;
      status = "out";
    } else {
      skuCount += 1;
      if (quantity <= inv.minQuantity) {
        lowCount += 1;
        status = "low";
      } else if (!recentlySold.has(inv.productId)) {
        stagnantCount += 1;
        status = "stagnant";
      } else {
        fastMovingCount += 1;
        status = "fast";
      }
    }

    inventoryItems.push({
      productId: inv.productId,
      name: inv.product.nameAr,
      barcode: inv.product.barcode,
      typeLabel: productTypeLabel(inv.product.type),
      category: inventoryCategoryLabel(inv.product),
      quantity,
      minQuantity: inv.minQuantity,
      unitCost: roundMoney(unitCost),
      stockValue: roundMoney(value),
      status,
    });

    stockValue += value;
    unitCount += quantity;
    if (isPhone) phoneStockValue += value;
    else accessoryStockValue += value;
  }

  inventoryItems.sort((a, b) => b.stockValue - a.stockValue);

  stockValue = roundMoney(stockValue);
  phoneStockValue = roundMoney(phoneStockValue);
  accessoryStockValue = roundMoney(accessoryStockValue);
  const periodDays = inclusivePeriodDays(from, to);
  const currentStockMovementRate =
    stockValue > 0 && cogsTotal > 0 ? roundMoney(cogsTotal / stockValue) : 0;
  const beginningStockValue = Math.max(0, roundMoney(stockValue - purchasesNetTotal + cogsTotal));
  const avgStockValue = roundMoney((beginningStockValue + stockValue) / 2);
  const inventoryTurnoverRate =
    avgStockValue > 0 && cogsTotal > 0 ? roundMoney(cogsTotal / avgStockValue) : 0;
  const avgDaysInStock =
    currentStockMovementRate > 0 ? Math.round(periodDays / currentStockMovementRate) : null;
  const inventoryEfficiency = stockValue > 0 ? roundMoney(salesNetTotal / stockValue) : 0;

  const inventory: BranchInventoryMetrics = {
    stockValue,
    unitCount,
    skuCount,
    phoneStockValue,
    accessoryStockValue,
    lowCount,
    outCount,
    stagnantCount,
    fastMovingCount,
    currentStockMovementRate,
    avgStockValue,
    inventoryTurnoverRate,
    avgDaysInStock,
    inventoryEfficiency,
    items: inventoryItems,
  };

  let surplusValue = 0;
  let shortageValue = 0;
  let itemsWithVariance = 0;
  let missingImeiCount = 0;
  let phoneShortageValue = 0;
  let accessoryShortageValue = 0;

  for (const stocktake of stocktakes) {
    for (const item of stocktake.items) {
      const adjustment = computeSavedStocktakeItemAdjustmentAmount(item);
      if (item.variance !== 0) itemsWithVariance += 1;
      if (adjustment > 0) surplusValue += adjustment;
      if (adjustment < 0) {
        shortageValue += Math.abs(adjustment);
        if (item.product.type === "phone") phoneShortageValue += Math.abs(adjustment);
        else accessoryShortageValue += Math.abs(adjustment);
      }
      if (item.serialsSnapshot) {
        try {
          const parsed = JSON.parse(item.serialsSnapshot) as { present?: boolean }[];
          missingImeiCount += parsed.filter((s) => s.present === false).length;
        } catch {
          /* ignore */
        }
      }
    }
  }

  const stocktake: BranchStocktakeMetrics = {
    count: stocktakes.length,
    surplusValue: roundMoney(surplusValue),
    shortageValue: roundMoney(shortageValue),
    netAdjustment: roundMoney(
      stocktakes.reduce((sum, st) => sum + sumSavedStocktakeItemAdjustmentAmount(st.items), 0)
    ),
    itemsWithVariance,
    missingImeiCount,
    phoneShortageValue: roundMoney(phoneShortageValue),
    accessoryShortageValue: roundMoney(accessoryShortageValue),
  };

  const priceByProduct = new Map(purchasePrices.map((row) => [row.productId, row.purchasePrice]));
  type ProductAgg = {
    productId: string;
    name: string;
    quantity: number;
    sales: number;
    cost: number;
  };
  const productMap = new Map<string, ProductAgg>();

  const mergeProduct = (
    key: string,
    patch: Partial<ProductAgg> & { deltaQty: number; deltaSales: number; deltaCost: number }
  ) => {
    const existing = productMap.get(key) ?? {
      productId: patch.productId || key,
      name: patch.name || "—",
      quantity: 0,
      sales: 0,
      cost: 0,
    };
    existing.quantity += patch.deltaQty;
    existing.sales += patch.deltaSales;
    existing.cost += patch.deltaCost;
    productMap.set(key, existing);
  };

  for (const item of saleItems) {
    const key = item.productId || item.description;
    const unitCost = item.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    mergeProduct(key, {
      productId: item.productId || key,
      name: item.product?.nameAr || item.description,
      deltaQty: item.quantity,
      deltaSales: item.total,
      deltaCost: item.quantity * unitCost,
    });
  }

  for (const item of returnItems) {
    const key = item.productId || item.description;
    const product = item.saleItem?.product ?? null;
    const unitCost =
      item.saleItem?.unitCost || (item.productId ? priceByProduct.get(item.productId) || 0 : 0);
    mergeProduct(key, {
      productId: item.productId || key,
      name: product?.nameAr || item.description,
      deltaQty: -item.quantity,
      deltaSales: -item.total,
      deltaCost: -(item.quantity * unitCost),
    });
  }

  const products = Array.from(productMap.values())
    .map((row) => ({
      productId: row.productId,
      name: row.name,
      quantity: row.quantity,
      sales: roundMoney(row.sales),
      profit: roundMoney(row.sales - row.cost),
    }))
    .filter((row) => row.quantity > 0 || row.sales > 0);

  const topByQuantity = [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 50);
  const topBySales = [...products].sort((a, b) => b.sales - a.sales).slice(0, 50);
  const topByProfit = [...products].sort((a, b) => b.profit - a.profit).slice(0, 50);
  const stagnantProducts = [...products]
    .filter((row) => row.quantity <= 2 && row.sales > 0)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 20);

  const brandGrossMap = new Map<string, { count: number; amount: number }>();
  let phoneSales = 0;
  let phoneCost = 0;
  for (const item of phoneSalesItems) {
    const brand = item.product?.brand || "غير محدد";
    const row = brandGrossMap.get(brand) ?? { count: 0, amount: 0 };
    row.count += item.quantity;
    row.amount += item.total;
    brandGrossMap.set(brand, row);
    phoneSales += item.total;
    phoneCost += item.quantity * (item.unitCost || 0);
  }

  let returnedCount = 0;
  let returnedAmount = 0;
  let returnedCost = 0;
  const brandReturnMap = new Map<string, { count: number; amount: number }>();
  for (const item of phoneReturnItems) {
    returnedCount += item.quantity;
    returnedAmount += item.total;
    returnedCost += item.quantity * (item.saleItem?.unitCost || 0);
    const brand = item.saleItem?.product?.brand || "غير محدد";
    const row = brandReturnMap.get(brand) ?? { count: 0, amount: 0 };
    row.count += item.quantity;
    row.amount += item.total;
    brandReturnMap.set(brand, row);
  }

  const soldCount = phoneSalesItems.reduce((sum, item) => sum + item.quantity, 0);
  const netSoldCount = soldCount - returnedCount;
  const netSoldAmount = roundMoney(phoneSales - returnedAmount);
  const phoneProfit = roundMoney(phoneSales - phoneCost - (returnedAmount - returnedCost));

  const brandKeys = new Set([...brandGrossMap.keys(), ...brandReturnMap.keys()]);
  const soldByBrand = Array.from(brandKeys)
    .map((brand) => {
      const gross = brandGrossMap.get(brand) ?? { count: 0, amount: 0 };
      const returned = brandReturnMap.get(brand) ?? { count: 0, amount: 0 };
      return {
        brand,
        count: gross.count - returned.count,
        amount: roundMoney(gross.amount - returned.amount),
      };
    })
    .filter((row) => row.count > 0 || row.amount > 0)
    .sort((a, b) => b.count - a.count || b.amount - a.amount);

  const phones: BranchPhoneMetrics = {
    soldCount,
    soldAmount: roundMoney(phoneSales),
    returnedCount,
    returnedAmount: roundMoney(returnedAmount),
    netSoldCount,
    netSoldAmount,
    soldByBrand,
    availableCount: availablePhones.length,
    usedStockCount: usedPhonesInStock,
    phoneStockValue: roundMoney(availablePhones.reduce((sum, s) => sum + (s.unitCost || 0), 0)),
    phoneStockCost: roundMoney(availablePhones.reduce((sum, s) => sum + (s.unitCost || 0), 0)),
    phoneSales: roundMoney(phoneSales),
    phoneProfit,
    usedCount: usedPhonesSold,
  };

  let employeeSalesTotal = 0;
  for (const sale of employeeSales) employeeSalesTotal += sale.total;
  const employeeMetrics: BranchEmployeeMetrics = {
    employeeCount: branchEmployees.length,
    salesTotal: roundMoney(employeeSalesTotal),
    salesPerEmployee:
      branchEmployees.length > 0 ? roundMoney(employeeSalesTotal / branchEmployees.length) : 0,
  };

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const buckets = buildChartBuckets(fromIso, toIso);
  const salesMap = new Map(buckets.map((b) => [b.key, 0]));
  for (const s of salesList) {
    const key = bucketDate(s.saleDate, fromIso, toIso);
    if (salesMap.has(key)) salesMap.set(key, (salesMap.get(key) || 0) + s.total);
  }
  for (const saleReturn of saleReturnsInRange) {
    const key = bucketDate(saleReturn.returnDate, fromIso, toIso);
    if (salesMap.has(key)) salesMap.set(key, (salesMap.get(key) || 0) - saleReturn.total);
  }
  const timeSeries = buckets.map((b) => ({
    label: b.label,
    sales: roundMoney(salesMap.get(b.key) || 0),
  }));

  return {
    branchId,
    branchName,
    branchCode,
    summary,
    inventory,
    stocktake,
    phones,
    employees: employeeMetrics,
    expensesByCategory: expensesByCategory.map((e) => ({
      category: e.category,
      amount: roundMoney(e._sum.amount || 0),
    })),
    topByQuantity,
    topBySales,
    topByProfit,
    stagnantProducts,
    timeSeries,
  };
}

export function resolveComparisonRange(
  compareMode: string,
  currentFrom: Date,
  currentTo: Date,
  compareFromParam?: string | null,
  compareToParam?: string | null
): { from: Date; to: Date } | null {
  if (compareMode === "none" || !compareMode) return null;

  if (compareMode === "custom" && compareFromParam && compareToParam) {
    return {
      from: startOfDay(new Date(compareFromParam)),
      to: endOfDay(new Date(compareToParam)),
    };
  }

  const durationMs = currentTo.getTime() - currentFrom.getTime();

  if (compareMode === "previous") {
    const to = endOfDay(new Date(currentFrom.getTime() - 86400000));
    const from = startOfDay(new Date(to.getTime() - durationMs));
    return { from, to };
  }

  if (compareMode === "prev_month") {
    const from = startOfDay(new Date(currentFrom));
    from.setMonth(from.getMonth() - 1);
    const to = endOfDay(new Date(currentTo));
    to.setMonth(to.getMonth() - 1);
    return { from, to };
  }

  if (compareMode === "prev_year") {
    const from = startOfDay(new Date(currentFrom));
    from.setFullYear(from.getFullYear() - 1);
    const to = endOfDay(new Date(currentTo));
    to.setFullYear(to.getFullYear() - 1);
    return { from, to };
  }

  return null;
}

export interface PerformanceScoreBreakdown {
  overall: number;
  sales: number;
  profitability: number;
  inventory: number;
  expenses: number;
  returns: number;
  insufficientData: boolean;
  weights: {
    sales: number;
    profitability: number;
    inventory: number;
    expenses: number;
    returns: number;
  };
  reasons: string[];
}

export function branchHasMeaningfulActivity(row: BranchComparisonRow): boolean {
  return (
    row.summary.salesNetTotal > 0 ||
    row.summary.cogsTotal > 0 ||
    row.summary.salesCount > 0
  );
}

const SCORE_WEIGHTS = {
  sales: 0.25,
  profitability: 0.25,
  inventory: 0.2,
  expenses: 0.2,
  returns: 0.1,
};

function percentileScore(values: number[], value: number, higherIsBetter: boolean) {
  if (values.length === 0) return 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === 0 && min === 0) return 0;
  if (max === min) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => (higherIsBetter ? v <= value : v >= value)).length;
  return Math.round((rank / sorted.length) * 100);
}

export function computePerformanceScores(
  rows: BranchComparisonRow[]
): Map<string, PerformanceScoreBreakdown> {
  const result = new Map<string, PerformanceScoreBreakdown>();
  if (rows.length === 0) return result;

  const activeRows = rows.filter(branchHasMeaningfulActivity);
  const emptyBreakdown = (reasons: string[]): PerformanceScoreBreakdown => ({
    overall: 0,
    sales: 0,
    profitability: 0,
    inventory: 0,
    expenses: 0,
    returns: 0,
    insufficientData: true,
    weights: {
      sales: SCORE_WEIGHTS.sales * 100,
      profitability: SCORE_WEIGHTS.profitability * 100,
      inventory: SCORE_WEIGHTS.inventory * 100,
      expenses: SCORE_WEIGHTS.expenses * 100,
      returns: SCORE_WEIGHTS.returns * 100,
    },
    reasons,
  });

  if (activeRows.length === 0) {
    for (const row of rows) {
      result.set(row.branchId, emptyBreakdown(["لا توجد بيانات كافية في هذه الفترة"]));
    }
    return result;
  }

  const salesVals = activeRows.map((r) => r.summary.salesNetTotal);
  const profitVals = activeRows.map((r) => r.summary.profitMargin);
  const turnoverVals = activeRows.map((r) => r.inventory.inventoryTurnoverRate);
  const expenseVals = activeRows.map((r) => r.summary.expensesToSalesRatio);
  const returnVals = activeRows.map((r) => r.summary.saleReturnsRate);

  for (const row of rows) {
    if (!branchHasMeaningfulActivity(row)) {
      result.set(row.branchId, emptyBreakdown(["لا توجد مبيعات أو نشاط في هذه الفترة"]));
      continue;
    }

    const sales = percentileScore(salesVals, row.summary.salesNetTotal, true);
    const profitability = percentileScore(profitVals, row.summary.profitMargin, true);
    const inventory = percentileScore(turnoverVals, row.inventory.inventoryTurnoverRate, true);
    const expenses = percentileScore(expenseVals, row.summary.expensesToSalesRatio, false);
    const returns = percentileScore(returnVals, row.summary.saleReturnsRate, false);
    const overall = Math.round(
      sales * SCORE_WEIGHTS.sales +
        profitability * SCORE_WEIGHTS.profitability +
        inventory * SCORE_WEIGHTS.inventory +
        expenses * SCORE_WEIGHTS.expenses +
        returns * SCORE_WEIGHTS.returns
    );

    const reasons: string[] = [];
    if (sales >= 80) reasons.push("أداء مبيعات متميز");
    if (profitability >= 80) reasons.push("هامش ربح قوي");
    if (inventory >= 80) reasons.push("دوران مخزون جيد");
    if (expenses >= 80) reasons.push("مصروفات منضبطة نسبة للمبيعات");
    if (returns >= 80) reasons.push("مرتجعات منخفضة");
    if (inventory < 40 && row.inventory.stockValue > row.summary.salesNetTotal * 0.5) {
      reasons.push("تنبيه: مخزون مرتفع مع حركة بيع ضعيفة");
    }
    if (returns < 40 && row.summary.saleReturnsRate > 0) {
      reasons.push("نسبة مرتجعات أعلى من المتوسط");
    }
    if (reasons.length === 0) reasons.push("أداء متوسط بين الفروع النشطة");

    result.set(row.branchId, {
      overall,
      sales,
      profitability,
      inventory,
      expenses,
      returns,
      insufficientData: false,
      weights: {
        sales: SCORE_WEIGHTS.sales * 100,
        profitability: SCORE_WEIGHTS.profitability * 100,
        inventory: SCORE_WEIGHTS.inventory * 100,
        expenses: SCORE_WEIGHTS.expenses * 100,
        returns: SCORE_WEIGHTS.returns * 100,
      },
      reasons,
    });
  }

  return result;
}

export async function buildProductCrossBranchComparison(
  rows: BranchComparisonRow[],
  productSearch?: string
) {
  const productBranches = new Map<
    string,
    {
      productId: string;
      name: string;
      branches: {
        branchId: string;
        branchName: string;
        quantity: number;
        sales: number;
        profit: number;
        stockQty: number;
      }[];
    }
  >();

  for (const row of rows) {
    const branchProducts = new Map<string, BranchProductHighlight>();
    for (const p of [...row.topByQuantity, ...row.topBySales, ...row.topByProfit]) {
      branchProducts.set(p.productId, p);
    }

    for (const [productId, p] of Array.from(branchProducts.entries())) {
      const entry = productBranches.get(productId) ?? {
        productId,
        name: p.name,
        branches: [] as {
          branchId: string;
          branchName: string;
          quantity: number;
          sales: number;
          profit: number;
          stockQty: number;
        }[],
      };
      const existing = entry.branches.find((b) => b.branchId === row.branchId);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, p.quantity);
        existing.sales = Math.max(existing.sales, p.sales);
        existing.profit = Math.max(existing.profit, p.profit);
      } else {
        entry.branches.push({
          branchId: row.branchId,
          branchName: row.branchName,
          quantity: p.quantity,
          sales: p.sales,
          profit: p.profit,
          stockQty: 0,
        });
      }
      productBranches.set(productId, entry);
    }
  }

  let list = Array.from(productBranches.values()).filter((p) => p.branches.length >= 2);
  if (productSearch?.trim()) {
    const q = productSearch.trim().toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  list.sort((a, b) => {
    const aSales = a.branches.reduce((s, b) => s + b.sales, 0);
    const bSales = b.branches.reduce((s, b) => s + b.sales, 0);
    return bSales - aSales;
  });

  return list.slice(0, 30);
}
