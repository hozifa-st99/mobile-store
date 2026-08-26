import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";
const productId = "60025906-79c4-4b14-bfab-95eb77fb7ab9";

const [entries, purchases, serials] = await Promise.all([
  prisma.stockEntryItem.findMany({
    where: { productId, stockEntry: { branchId, status: "completed" } },
    select: { imeisSnapshot: true, stockEntry: { select: { documentNumber: true } } },
  }),
  prisma.purchaseItem.findMany({
    where: { productId, purchase: { branchId, status: "completed" } },
    select: { imeisSnapshot: true, purchase: { select: { invoiceNumber: true } } },
  }),
  prisma.productSerial.findMany({
    where: { branchId, productId },
    include: { imeiEntries: true },
  }),
]);

console.log("entries", entries);
console.log("purchases", purchases);
console.log("serials", serials.length);

await prisma.$disconnect();
