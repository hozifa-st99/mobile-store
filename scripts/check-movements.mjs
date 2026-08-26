import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";
const productId = "19d19038-b1f3-44d9-9392-089c751e7cc6";

function parseImeisSnapshot(snapshot) {
  if (!snapshot?.trim()) return [];
  const seen = new Set();
  const list = [];
  for (const part of snapshot.split(/[,/|]/)) {
    const imei = part.trim();
    if (!imei || seen.has(imei)) continue;
    seen.add(imei);
    list.push(imei);
  }
  return list;
}

const [stockEntries, purchases, stocktakes] = await Promise.all([
  prisma.stockEntryItem.findMany({
    where: { productId, stockEntry: { branchId, status: "completed" } },
    select: { id: true, imeisSnapshot: true, stockEntry: { select: { documentNumber: true } } },
  }),
  prisma.purchaseItem.findMany({
    where: { productId, purchase: { branchId, status: "completed" } },
    select: { id: true, imeisSnapshot: true, purchase: { select: { invoiceNumber: true } } },
  }),
  prisma.stocktakeItem.findMany({
    where: { productId, stocktake: { branchId, status: "completed" }, variance: { not: 0 } },
    select: {
      variance: true,
      serialsSnapshot: true,
      imeiSnapshot: true,
      stocktake: { select: { documentNumber: true } },
    },
  }),
]);

console.log("stock entries:", stockEntries.length);
for (const item of stockEntries) {
  console.log(" ", item.stockEntry.documentNumber, parseImeisSnapshot(item.imeisSnapshot));
}

console.log("purchases:", purchases.length);
for (const item of purchases) {
  console.log(" ", item.purchase.invoiceNumber, parseImeisSnapshot(item.imeisSnapshot));
}

console.log("stocktakes:", stocktakes.length);
for (const item of stocktakes) {
  const snaps = item.serialsSnapshot ? JSON.parse(item.serialsSnapshot) : [];
  const absent = snaps.filter((s) => !s.present);
  console.log(
    " ",
    item.stocktake.documentNumber,
    "var",
    item.variance,
    "absent devices",
    absent.length,
    "legacy imeiSnapshot count",
    parseImeisSnapshot(item.imeiSnapshot).length
  );
}

await prisma.$disconnect();
