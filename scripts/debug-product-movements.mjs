import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const productName = process.argv[2] || "Galaxy S24 Ultra";

const inv = await prisma.branchInventory.findFirst({
  where: { product: { nameAr: { contains: productName } } },
  include: { product: true },
});

if (!inv) {
  console.log("Not found");
  process.exit(1);
}

console.log("Product:", inv.product.nameAr, inv.product.type);
console.log("DB qty:", inv.quantity);

const serials = await prisma.productSerial.findMany({
  where: { branchId: inv.branchId, productId: inv.productId },
  select: {
    id: true,
    status: true,
    stockEntryItemId: true,
    purchaseItemId: true,
    imeiEntries: { select: { imei: true } },
  },
});
console.log("\nSerials:", serials.length);
for (const s of serials) {
  console.log(
    " -",
    s.status,
    s.imeiEntries.map((e) => e.imei).join("/"),
    "stockEntryItem:",
    s.stockEntryItemId?.slice(0, 8),
    "purchaseItem:",
    s.purchaseItemId?.slice(0, 8)
  );
}

const stockEntries = await prisma.stockEntryItem.findMany({
  where: { productId: inv.productId, stockEntry: { branchId: inv.branchId, status: "completed" } },
  include: { stockEntry: { select: { documentNumber: true, entryDate: true } } },
});
console.log("\nStock entry lines:", stockEntries.length);
for (const se of stockEntries) {
  console.log(" -", se.stockEntry.documentNumber, "qty:", se.quantity, "id:", se.id.slice(0, 8));
}

const purchases = await prisma.purchaseItem.findMany({
  where: { productId: inv.productId, purchase: { branchId: inv.branchId, status: "completed" } },
  include: { purchase: { select: { invoiceNumber: true } } },
});
console.log("\nPurchase lines:", purchases.length);
for (const p of purchases) {
  console.log(" -", p.purchase.invoiceNumber, "qty:", p.quantity);
}

const sales = await prisma.saleItem.findMany({
  where: { productId: inv.productId, sale: { branchId: inv.branchId, status: "completed" } },
  include: { sale: { select: { invoiceNumber: true } } },
});
console.log("\nSales:", sales.length);
for (const s of sales) {
  console.log(" -", s.sale.invoiceNumber, "qty:", s.quantity);
}

const stocktakes = await prisma.stocktakeItem.findMany({
  where: { productId: inv.productId, stocktake: { branchId: inv.branchId, status: "completed" } },
  include: { stocktake: { select: { documentNumber: true } } },
});
console.log("\nStocktakes:", stocktakes.length);
for (const st of stocktakes) {
  console.log(
    " -",
    st.stocktake.documentNumber,
    "sys:",
    st.systemQuantity,
    "counted:",
    st.countedQuantity,
    "var:",
    st.variance
  );
}

await prisma.$disconnect();
