import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_SALE_ID = "sale-1";
const DEMO_MAINTENANCE_ID = "mnt-1";
const DEMO_EXPENSE_ID = "exp-1";
const DEMO_PRODUCT_IDS = ["prod-1", "prod-2", "prod-3", "prod-4", "prod-5"];
const DEMO_CUSTOMER_IDS = ["cust-1", "cust-2"];
const DEMO_SUPPLIER_IDS = ["sup-1", "sup-2"];
const DEMO_PHONE_PLATFORM_IDS = ["plat-iphone", "plat-android"];
const DEMO_PHONE_BRAND_IDS = ["brand-samsung", "brand-xiaomi"];
const DEMO_PHONE_MODEL_IDS = ["model-iphone15pm", "model-iphone14", "model-s24", "model-redmi"];
const DEMO_ITEM_CATEGORY_IDS = ["item-cat-headphones", "item-cat-watches"];
const DEMO_ITEM_BRAND_IDS = ["item-brand-apple-audio", "item-brand-sony", "item-brand-samsung-watch"];
const DEMO_PRODUCT_CATEGORY_IDS = ["cat-phones", "cat-acc"];
const DEMO_EXTRA_BRANCH_IDS = ["branch-2", "branch-3"];
const DEMO_CASHIER_USERNAME = "cashier";

async function branchHasActivity(branchId: string) {
  const counts = await Promise.all([
    prisma.sale.count({ where: { branchId } }),
    prisma.purchase.count({ where: { branchId } }),
    prisma.branchInventory.count({ where: { branchId } }),
    prisma.expense.count({ where: { branchId } }),
    prisma.stockEntry.count({ where: { branchId } }),
    prisma.maintenanceOrder.count({ where: { branchId } }),
  ]);
  return counts.some((count) => count > 0);
}

async function removeLegacyDemoData() {
  await prisma.sale.deleteMany({ where: { id: DEMO_SALE_ID } });
  await prisma.maintenanceOrder.deleteMany({ where: { id: DEMO_MAINTENANCE_ID } });
  await prisma.expense.deleteMany({ where: { id: DEMO_EXPENSE_ID } });

  await prisma.branchInventory.deleteMany({
    where: { productId: { in: DEMO_PRODUCT_IDS } },
  });
  await prisma.productSerial.deleteMany({
    where: { productId: { in: DEMO_PRODUCT_IDS } },
  });
  await prisma.product.deleteMany({ where: { id: { in: DEMO_PRODUCT_IDS } } });

  const demoCreditEntries = await prisma.creditLedgerEntry.findMany({
    where: { customerId: { in: DEMO_CUSTOMER_IDS } },
    select: { id: true },
  });
  if (demoCreditEntries.length > 0) {
    await prisma.creditLedgerPayment.deleteMany({
      where: { entryId: { in: demoCreditEntries.map((e) => e.id) } },
    });
    await prisma.creditLedgerEntry.deleteMany({
      where: { id: { in: demoCreditEntries.map((e) => e.id) } },
    });
  }

  await prisma.customer.deleteMany({ where: { id: { in: DEMO_CUSTOMER_IDS } } });

  const demoSupplierCreditEntries = await prisma.creditLedgerEntry.findMany({
    where: { supplierId: { in: DEMO_SUPPLIER_IDS } },
    select: { id: true },
  });
  if (demoSupplierCreditEntries.length > 0) {
    await prisma.creditLedgerPayment.deleteMany({
      where: { entryId: { in: demoSupplierCreditEntries.map((e) => e.id) } },
    });
    await prisma.creditLedgerEntry.deleteMany({
      where: { id: { in: demoSupplierCreditEntries.map((e) => e.id) } },
    });
  }

  const demoSuppliersWithPurchases = await prisma.purchase.findMany({
    where: { supplierId: { in: DEMO_SUPPLIER_IDS } },
    select: { supplierId: true },
    distinct: ["supplierId"],
  });
  const blockedSupplierIds = new Set(
    demoSuppliersWithPurchases.map((row) => row.supplierId).filter(Boolean) as string[]
  );
  const deletableSupplierIds = DEMO_SUPPLIER_IDS.filter((id) => !blockedSupplierIds.has(id));
  if (deletableSupplierIds.length > 0) {
    await prisma.supplier.deleteMany({ where: { id: { in: deletableSupplierIds } } });
  }

  const demoPhoneModelsInUse = await prisma.product.count({
    where: { phoneModelId: { in: DEMO_PHONE_MODEL_IDS } },
  });
  if (demoPhoneModelsInUse === 0) {
    await prisma.phoneModel.deleteMany({ where: { id: { in: DEMO_PHONE_MODEL_IDS } } });
    await prisma.phoneBrand.deleteMany({ where: { id: { in: DEMO_PHONE_BRAND_IDS } } });
    await prisma.phonePlatform.deleteMany({ where: { id: { in: DEMO_PHONE_PLATFORM_IDS } } });
  }

  const demoItemCatalogInUse = await prisma.product.count({
    where: {
      OR: [
        { itemCategoryId: { in: DEMO_ITEM_CATEGORY_IDS } },
        { itemBrandId: { in: DEMO_ITEM_BRAND_IDS } },
      ],
    },
  });
  if (demoItemCatalogInUse === 0) {
    await prisma.itemCategory.deleteMany({ where: { id: { in: DEMO_ITEM_CATEGORY_IDS } } });
  }

  const demoProductCategoriesInUse = await prisma.product.count({
    where: { categoryId: { in: DEMO_PRODUCT_CATEGORY_IDS } },
  });
  if (demoProductCategoriesInUse === 0) {
    await prisma.productCategory.deleteMany({ where: { id: { in: DEMO_PRODUCT_CATEGORY_IDS } } });
  }

  const demoCashier = await prisma.user.findUnique({
    where: { username: DEMO_CASHIER_USERNAME },
    select: { id: true },
  });
  if (demoCashier) {
    await prisma.userScreenPermission.deleteMany({ where: { userId: demoCashier.id } });
    await prisma.userBranch.deleteMany({ where: { userId: demoCashier.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: demoCashier.id } });
    await prisma.user.delete({ where: { id: demoCashier.id } });
  }

  for (const branchId of DEMO_EXTRA_BRANCH_IDS) {
    if (await branchHasActivity(branchId)) continue;
    await prisma.userBranch.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
  }
}

async function main() {
  await removeLegacyDemoData();

  const passwordHash = await bcrypt.hash("123456", 12);
  const superAdminPasswordHash = await bcrypt.hash("0000mobile0000", 12);

  const company = await prisma.company.upsert({
    where: { id: "company-1" },
    update: {
      siteActivatedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "company-1",
      name: "Company",
      nameAr: "شركتي",
      siteActivatedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { id: "branch-1" },
    update: {
      code: "MAIN",
      name: "Main Branch",
      nameAr: "الفرع الرئيسي",
      address: null,
      phone: null,
    },
    create: {
      id: "branch-1",
      companyId: company.id,
      code: "MAIN",
      name: "Main Branch",
      nameAr: "الفرع الرئيسي",
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      role: "super_admin",
      isHidden: true,
      passwordHash: superAdminPasswordHash,
    },
    create: {
      companyId: company.id,
      username: "superadmin",
      passwordHash: superAdminPasswordHash,
      fullName: "Super Admin",
      fullNameAr: "السوبر أدمن",
      role: "super_admin",
      isHidden: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { role: "admin", isHidden: false },
    create: {
      companyId: company.id,
      username: "admin",
      passwordHash,
      fullName: "System Admin",
      fullNameAr: "مدير النظام",
      role: "admin",
    },
  });

  for (const user of [superAdmin, admin]) {
    await prisma.userBranch.upsert({
      where: {
        userId_branchId: { userId: user.id, branchId: mainBranch.id },
      },
      update: { isDefault: true },
      create: {
        userId: user.id,
        branchId: mainBranch.id,
        isDefault: true,
      },
    });
  }

  console.log("✅ Seed completed — بداية واقعية (شركة + فرع رئيسي + حسابات إدارة فقط)");
  console.log("   superadmin / 0000mobile0000 — تفعيل الموقع (مخفي)");
  console.log("   admin / 123456 — مدير النظام (غيّر كلمة المرور من الإعدادات → المستخدمين)");
  console.log("   لا توجد قوائم موبايلات/أصناف/عملاء/موردين — أضفها من الإعدادات");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
