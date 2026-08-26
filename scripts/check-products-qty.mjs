import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";

const inventories = await prisma.branchInventory.findMany({
  where: { branchId, product: { deletedAt: null, isActive: true } },
  include: { product: { select: { nameAr: true, type: true } } },
});

for (const inv of inventories) {
  const serials =
    inv.product.type === "phone"
      ? await prisma.productSerial.count({
          where: { branchId, productId: inv.productId, status: "available" },
        })
      : null;

  const lastSt = await prisma.stocktakeItem.findFirst({
    where: {
      productId: inv.productId,
      stocktake: { branchId, status: "completed" },
    },
    orderBy: { stocktake: { createdAt: "desc" } },
    include: { stocktake: { select: { documentNumber: true } } },
  });

  console.log(
    inv.product.nameAr.slice(0, 20),
    inv.product.type,
    "inv.qty",
    inv.quantity,
    "serials",
    serials,
    "last stk",
    lastSt?.stocktake.documentNumber,
    "cnt",
    lastSt?.countedQuantity,
    "var",
    lastSt?.variance
  );
}

await prisma.$disconnect();
