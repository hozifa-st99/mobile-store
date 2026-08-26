import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const productId = "b73ae6a0-a470-416f-b0ea-65c2480c08d5";

const inv = await prisma.branchInventory.findFirst({ where: { productId } });
const serials = await prisma.productSerial.findMany({
  where: { productId },
  include: {
    imeiEntries: true,
    stockEntryItem: { include: { stockEntry: { select: { documentNumber: true } } } },
    purchaseItem: { include: { purchase: { select: { invoiceNumber: true } } } },
  },
});
const stk = await prisma.stocktakeItem.findMany({
  where: { productId },
  include: { stocktake: { select: { documentNumber: true, stocktakeDate: true, createdAt: true } } },
  orderBy: { stocktake: { createdAt: "asc" } },
});
const se = await prisma.stockEntryItem.findMany({
  where: { productId },
  include: { stockEntry: { select: { documentNumber: true, entryDate: true, createdAt: true } } },
});

console.log("=== iPhone 14 audit ===");
console.log("branchInventory.quantity:", inv?.quantity);
console.log("\nserials:");
for (const s of serials) {
  console.log(
    " ",
    s.id.slice(0, 8),
    s.status,
    s.imeiEntries.map((e) => e.imei).join("/"),
    "stk:",
    s.stockEntryItem?.stockEntry?.documentNumber,
    "pur:",
    s.purchaseItem?.purchase?.invoiceNumber
  );
}
console.log("\nstocktakes:");
for (const s of stk) {
  console.log(
    " ",
    s.stocktake.documentNumber,
    "date",
    s.stocktake.stocktakeDate.toISOString(),
    "sys",
    s.systemQuantity,
    "counted",
    s.countedQuantity,
    "var",
    s.variance,
    "imeiSnap",
    s.imeiSnapshot
  );
}
console.log("\nstock entries:");
for (const s of se) {
  console.log(
    " ",
    s.stockEntry.documentNumber,
    "date",
    s.stockEntry.entryDate.toISOString(),
    "qty",
    s.quantity,
    "imeiSnap",
    s.imeisSnapshot
  );
}

await prisma.$disconnect();
