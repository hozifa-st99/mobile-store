/**
 * مسح كل الداتا التشغيلية — يحتفظ بالإعدادات والمستخدمين والفروع والكتalog.
 * Usage: node scripts/wipe-business-data.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function wipe() {
  const counts = {};

  await prisma.$transaction(async (tx) => {
    counts.treasuryShiftEntries = (await tx.treasuryShiftEntry.deleteMany()).count;
    counts.treasuryShifts = (await tx.treasuryShift.deleteMany()).count;

    counts.saleReturnItems = (await tx.saleReturnItem.deleteMany()).count;
    counts.saleReturns = (await tx.saleReturn.deleteMany()).count;
    counts.saleItems = (await tx.saleItem.deleteMany()).count;
    counts.sales = (await tx.sale.deleteMany()).count;

    counts.purchaseItemCostAdjustments = (
      await tx.purchaseItemCostAdjustment.deleteMany()
    ).count;
    counts.purchaseReturnItems = (await tx.purchaseReturnItem.deleteMany()).count;
    counts.purchaseReturns = (await tx.purchaseReturn.deleteMany()).count;

    counts.productSerialImeis = (await tx.productSerialImei.deleteMany()).count;
    counts.productSerials = (await tx.productSerial.deleteMany()).count;
    counts.retailPriceChanges = (await tx.retailPriceChange.deleteMany()).count;

    counts.stocktakeItems = (await tx.stocktakeItem.deleteMany()).count;
    counts.stocktakes = (await tx.stocktake.deleteMany()).count;

    counts.stockEntryItems = (await tx.stockEntryItem.deleteMany()).count;
    counts.stockEntries = (await tx.stockEntry.deleteMany()).count;

    counts.purchaseItems = (await tx.purchaseItem.deleteMany()).count;
    counts.purchases = (await tx.purchase.deleteMany()).count;

    counts.expenses = (await tx.expense.deleteMany()).count;
    counts.expenseDocuments = (await tx.expenseDocument.deleteMany()).count;
    counts.maintenanceOrders = (await tx.maintenanceOrder.deleteMany()).count;

    counts.branchInventories = (await tx.branchInventory.deleteMany()).count;
    counts.products = (await tx.product.deleteMany()).count;

    counts.suppliersReset = (
      await tx.supplier.updateMany({ data: { balance: 0 } })
    ).count;
    counts.customersReset = (
      await tx.customer.updateMany({ data: { balance: 0 } })
    ).count;

    counts.refreshTokens = (await tx.refreshToken.deleteMany()).count;
  });

  console.log("=== Business data wiped ===");
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key}: ${value}`);
  }

  const verify = {
    sales: await prisma.sale.count(),
    purchases: await prisma.purchase.count(),
    serials: await prisma.productSerial.count(),
    inventories: await prisma.branchInventory.count(),
    products: await prisma.product.count(),
    stocktakes: await prisma.stocktake.count(),
    stockEntries: await prisma.stockEntry.count(),
  };

  console.log("\n=== Verification (should all be 0) ===");
  console.log(verify);

  const kept = {
    users: await prisma.user.count(),
    branches: await prisma.branch.count(),
    phoneModels: await prisma.phoneModel.count(),
    suppliers: await prisma.supplier.count(),
  };

  console.log("\n=== Kept ===");
  console.log(kept);
}

await wipe();
await prisma.$disconnect();
