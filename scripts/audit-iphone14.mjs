import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "b73ae6a0-a470-416f-b0ea-65c2480c08d5";

const product = await prisma.product.findUnique({
  where: { id: productId },
  include: { branchInventory: { where: { branchId: "branch-1" } } },
});

console.log("Product:", product?.nameAr, product?.color, product?.storage);
console.log("Inventory qty:", product?.branchInventory[0]?.quantity);

const serials = await prisma.productSerial.findMany({
  where: { productId, branchId: "branch-1" },
  include: {
    imeiEntries: true,
    purchaseItem: { include: { purchase: true } },
    stockEntryItem: { include: { stockEntry: true } },
  },
});
console.log("\n=== SERIALS ===");
for (const s of serials) {
  console.log({
    id: s.id.slice(0, 8),
    status: s.status,
    imeis: s.imeiEntries.map((e) => e.imei),
    purchaseItem: s.purchaseItemId?.slice(0, 8),
    purchaseProduct: s.purchaseItem?.productId?.slice(0, 8),
    stockEntry: s.stockEntryItem?.stockEntry?.documentNumber,
    stockProduct: s.stockEntryItem?.productId?.slice(0, 8),
  });
}

const stkItems = await prisma.stockEntryItem.findMany({
  where: { productId },
  include: { stockEntry: true },
});
console.log("\n=== STOCK ENTRY ITEMS ===");
for (const i of stkItems) {
  console.log(i.stockEntry.documentNumber, i.stockEntry.status, "qty", i.quantity, "imeiSnap", i.imeisSnapshot?.slice(0, 30));
}

const stItems = await prisma.stocktakeItem.findMany({
  where: { productId },
  include: { stocktake: true },
  orderBy: { stocktake: { stocktakeDate: "asc" } },
});
console.log("\n=== STOCKTAKE ITEMS ===");
for (const i of stItems) {
  console.log({
    doc: i.stocktake.documentNumber,
    date: i.stocktake.stocktakeDate.toISOString().slice(0, 16),
    sys: i.systemQuantity,
    counted: i.countedQuantity,
    var: i.variance,
    imeiSnap: i.imeiSnapshot?.slice(0, 40),
    desc: i.description?.split("\n")[0]?.slice(0, 50),
  });
}

const sales = await prisma.saleItem.findMany({
  where: { productId },
  include: { sale: true },
});
console.log("\n=== SALES ===", sales.length);

// Related products same model group?
const related = await prisma.product.findMany({
  where: { nameAr: { contains: "iPhone 14" } },
  include: { branchInventory: { where: { branchId: "branch-1" } } },
});
console.log("\n=== ALL iPhone 14 PRODUCTS ===");
for (const p of related) {
  const sc = await prisma.productSerial.count({ where: { productId: p.id, branchId: "branch-1" } });
  const st = await prisma.stocktakeItem.findMany({ where: { productId: p.id }, include: { stocktake: true } });
  console.log(p.id.slice(0, 8), p.nameAr, p.color, p.storage, "inv:", p.branchInventory[0]?.quantity, "serials:", sc);
  for (const s of st) console.log("  stk", s.stocktake.documentNumber, "var", s.variance);
}

await prisma.$disconnect();
