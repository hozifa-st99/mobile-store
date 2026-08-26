import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "c47d9e3f-e62d-475e-9943-0ac56352814d";

const purchases = await prisma.purchaseItem.findMany({
  where: { productId, purchase: { status: "completed" } },
  include: { purchase: { select: { invoiceNumber: true } } },
});

const serials = await prisma.productSerial.findMany({
  where: { productId },
  select: { id: true, status: true, purchaseItemId: true, imeiEntries: { select: { imei: true } } },
});

console.log("Purchase items:");
for (const p of purchases) {
  const linked = serials.filter((s) => s.purchaseItemId === p.id);
  console.log(p.purchase.invoiceNumber, "qty", p.quantity, "serials", linked.length, linked.map((s) => s.status));
}

console.log("\nSerials without purchase item:", serials.filter((s) => !s.purchaseItemId).length);

await prisma.$disconnect();
