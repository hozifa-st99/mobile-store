import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  where: { nameAr: { contains: "iPhone 15 Pro Max" } },
  include: { branchInventory: true },
});

for (const pr of products) {
  const serials = await prisma.productSerial.count({ where: { productId: pr.id } });
  const sales = await prisma.saleItem.count({ where: { productId: pr.id } });
  const stk = await prisma.stocktakeItem.findMany({
    where: { productId: pr.id },
    include: { stocktake: true },
  });
  console.log(pr.id.slice(0, 8), pr.nameAr, pr.color, pr.storage, "inv:", pr.branchInventory[0]?.quantity, "serials:", serials, "sales:", sales);
  for (const s of stk) console.log("  stk", s.stocktake.documentNumber, "sys", s.systemQuantity, "var", s.variance);
}

await prisma.$disconnect();
