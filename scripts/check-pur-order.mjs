import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const pur = await prisma.purchase.findFirst({
  where: { invoiceNumber: "PUR-MAD-00740534" },
  include: { items: { orderBy: { id: "asc" } } },
});
for (const [i, it] of pur.items.entries()) {
  console.log(i, it.id.slice(0, 8), it.productId.slice(0, 8), it.description.slice(0, 40));
}
await prisma.$disconnect();
