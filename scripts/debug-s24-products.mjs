import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  where: { nameAr: { contains: "S24" } },
  select: { id: true, nameAr: true, color: true, storage: true },
});

console.log("Products:", products);

for (const p of products) {
  const inv = await prisma.branchInventory.findFirst({ where: { productId: p.id } });
  const serials = await prisma.productSerial.count({ where: { productId: p.id, status: "available" } });
  const stItems = await prisma.stocktakeItem.findMany({
    where: { productId: p.id },
    include: { stocktake: { select: { documentNumber: true } } },
  });
  console.log("\n", p.nameAr, p.id.slice(0, 8));
  console.log("  inv qty:", inv?.quantity, "available serials:", serials);
  for (const st of stItems) {
    console.log("  stocktake:", st.stocktake.documentNumber, "sys", st.systemQuantity, "counted", st.countedQuantity, "var", st.variance);
  }
}

await prisma.$disconnect();
