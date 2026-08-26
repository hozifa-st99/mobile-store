import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const item = await prisma.stocktakeItem.findFirst({
  where: { product: { nameAr: { contains: "Galaxy S24" } } },
  include: { stocktake: true, product: true },
});

console.log({
  doc: item?.stocktake.documentNumber,
  sys: item?.systemQuantity,
  counted: item?.countedQuantity,
  variance: item?.variance,
  imeiSnapshot: item?.imeiSnapshot,
});

await prisma.$disconnect();
