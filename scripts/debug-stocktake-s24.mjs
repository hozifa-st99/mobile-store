import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const stocktakeId = "f39645c7-e0c3-4d7e-bdct-2d75c2a92fde";

const st = await prisma.stocktake.findUnique({
  where: { id: stocktakeId },
  include: {
    items: {
      include: { product: { select: { nameAr: true, type: true } } },
    },
  },
});

console.log("Stocktake:", st?.documentNumber, "total variance:", st?.totalVariance);
for (const item of st?.items ?? []) {
  if (item.product?.nameAr?.includes("S24") || item.product?.nameAr?.includes("Galaxy")) {
    console.log({
      name: item.product.nameAr,
      sys: item.systemQuantity,
      counted: item.countedQuantity,
      variance: item.variance,
      productId: item.productId,
    });
  }
}

const galaxy = await prisma.product.findFirst({
  where: { nameAr: { contains: "Galaxy S24" } },
});
if (galaxy) {
  const allStItems = await prisma.stocktakeItem.findMany({
    where: { productId: galaxy.id },
    include: { stocktake: { select: { documentNumber: true } } },
  });
  console.log("\nAll stocktake items for Galaxy S24:");
  for (const i of allStItems) {
    console.log(i.stocktake.documentNumber, "sys:", i.systemQuantity, "counted:", i.countedQuantity, "var:", i.variance);
  }
}

await prisma.$disconnect();
