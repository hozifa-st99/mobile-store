/**
 * مسح حركات المخzون والفواتير — الإبقاء على:
 * - الشركة / الفروع / المستخدمين / الإعدادات
 * - كatalوج الموبaيلات (PhonePlatform, PhoneBrand, PhoneModel, …)
 * - كatalوج الأصnaف (ItemCategory, ItemBrand, ItemName)
 * - الموردين والعملاء
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearTransactionalData() {
  await prisma.$transaction(async (tx) => {
    await tx.creditLedgerPayment.deleteMany();
    await tx.creditLedgerEntry.deleteMany();

    await tx.treasuryShiftEntry.deleteMany();
    await tx.treasuryShift.deleteMany();
    await tx.branchVaultMovement.deleteMany();

    await tx.expense.deleteMany();
    await tx.expenseDocument.deleteMany();

    await tx.saleReturnItem.deleteMany();
    await tx.saleReturn.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.sale.deleteMany();

    await tx.purchaseItemCostAdjustment.deleteMany();
    await tx.purchaseReceivableCollection.deleteMany();
    await tx.purchaseSupplierReceivable.deleteMany();
    await tx.purchaseReturnItem.deleteMany();
    await tx.purchaseReturn.deleteMany();

    await tx.stocktakeItem.deleteMany();
    await tx.stocktake.deleteMany();

    await tx.retailPriceChange.deleteMany();
    await tx.productSerialImei.deleteMany();
    await tx.productSerial.deleteMany();

    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();

    await tx.stockEntryItem.deleteMany();
    await tx.stockEntry.deleteMany();

    await tx.branchInventory.deleteMany();
    await tx.maintenanceOrder.deleteMany();
    await tx.product.deleteMany();
  });
}

async function main() {
  await clearTransactionalData();

  const kept = await Promise.all([
    prisma.phonePlatform.count(),
    prisma.phoneBrand.count(),
    prisma.phoneModel.count(),
    prisma.itemCategory.count(),
    prisma.itemBrand.count(),
    prisma.itemName.count(),
    prisma.supplier.count(),
    prisma.customer.count(),
    prisma.branch.count(),
    prisma.user.count(),
  ]);

  console.log("✅ تم مسح الفواتير وأرصدة الحركة");
  console.log("   محذوف: مبيعات، مشتريات، مرتجعات، جرد، إدخال رصيد، مخزون، منتجات، سيريالات");
  console.log("   محفوظ:");
  console.log(`   - كatalog موبايلات: ${kept[0]} منصة، ${kept[1]} ماركة، ${kept[2]} موديل`);
  console.log(`   - كatalog أصناف: ${kept[3]} فئة، ${kept[4]} ماركة، ${kept[5]} اسم`);
  console.log(`   - ${kept[6]} مورد، ${kept[7]} عميل، ${kept[8]} فرع، ${kept[9]} مستخدم`);
}

main()
  .catch((error) => {
    console.error("❌ فشل المسح:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
