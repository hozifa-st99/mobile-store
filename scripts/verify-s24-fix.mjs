import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "c47d9e3f-e62d-475e-9943-0ac56352814d";
const branchId = "branch-1";

function serialBelongsToProduct(serial, productId) {
  if (serial.purchaseItem?.productId != null && serial.purchaseItem.productId !== productId) return false;
  if (serial.stockEntryItem?.productId != null && serial.stockEntryItem.productId !== productId) return false;
  return true;
}

const serials = await prisma.productSerial.findMany({
  where: { branchId, productId },
  include: {
    imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
    purchaseItem: { include: { purchase: { select: { invoiceNumber: true } } } },
  },
});

console.log("=== Purchase history (filtered serials) ===");
for (const s of serials.filter((x) => serialBelongsToProduct(x, productId))) {
  console.log(
    s.purchaseItem?.purchase?.invoiceNumber ?? "stock",
    s.imeiEntries.map((e) => e.imei).join(" · "),
    s.status
  );
}

console.log("\n=== Movement inbound (per serial) ===");
for (const s of serials.filter((x) => serialBelongsToProduct(x, productId))) {
  if (s.purchaseItem?.productId === productId) {
    console.log("+1", s.purchaseItem.purchase.invoiceNumber, s.imeiEntries.map((e) => e.imei).join(" · "));
  }
}

const sales = await prisma.saleItem.findMany({
  where: { productId, sale: { branchId, status: "completed" } },
  include: { sale: { select: { invoiceNumber: true } } },
});
console.log("\n=== Sales ===");
for (const s of sales) console.log("-1", s.sale.invoiceNumber, s.imei);

const avail = serials.filter((x) => serialBelongsToProduct(x, productId) && x.status === "available").length;
const inbound = serials.filter((x) => serialBelongsToProduct(x, productId) && x.purchaseItem?.productId === productId).length;
console.log("\nInbound:", inbound, "Sales:", sales.length, "Balance:", inbound - sales.reduce((a, s) => a + s.quantity, 0), "Available:", avail);

await prisma.$disconnect();
