import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const purchase = await prisma.purchase.findFirst({
  where: { invoiceNumber: "PUR-MAD-00740534" },
  include: { items: true },
});

console.log("Items on 00740534:", purchase?.items.map((i) => ({ id: i.id.slice(0, 8), productId: i.productId.slice(0, 8), qty: i.quantity })));

const serials = await prisma.productSerial.findMany({
  where: { purchaseItem: { purchase: { invoiceNumber: "PUR-MAD-00740534" } } },
  select: { id: true, purchaseItemId: true, status: true },
});
console.log("Serials:", serials);

await prisma.$disconnect();
