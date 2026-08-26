import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "c47d9e3f-e62d-475e-9943-0ac56352814d";

const items = await prisma.purchaseItem.findMany({
  where: { productId },
  include: { purchase: { select: { invoiceNumber: true, status: true, branchId: true } } },
});

for (const i of items) {
  console.log(i.id.slice(0, 8), i.purchase.invoiceNumber, i.purchase.status, "qty", i.quantity);
}

await prisma.$disconnect();
