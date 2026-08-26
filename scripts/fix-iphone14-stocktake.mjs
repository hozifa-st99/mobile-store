import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "b73ae6a0-a470-416f-b0ea-65c2480c08d5";
const branchId = "branch-1";

const lastAdjusting = await prisma.stocktakeItem.findFirst({
  where: {
    productId,
    variance: { not: 0 },
    stocktake: { branchId, status: "completed" },
  },
  orderBy: { stocktake: { createdAt: "desc" } },
  include: { stocktake: true },
});

console.log("last adjusting stocktake:", lastAdjusting?.stocktake.documentNumber, "counted", lastAdjusting?.countedQuantity);

const serials = await prisma.productSerial.findMany({ where: { branchId, productId, status: "available" } });
console.log("available serials before:", serials.length);

if (lastAdjusting && serials.length > lastAdjusting.countedQuantity) {
  const toRemove = serials.slice(0, serials.length - lastAdjusting.countedQuantity);
  for (const s of toRemove) {
    await prisma.productSerial.delete({ where: { id: s.id } });
    console.log("deleted serial", s.id.slice(0, 8));
  }
  await prisma.branchInventory.updateMany({
    where: { branchId, productId },
    data: { quantity: lastAdjusting.countedQuantity },
  });
}

const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
const count = await prisma.productSerial.count({ where: { branchId, productId, status: "available" } });
console.log("after: inv qty", inv?.quantity, "serials", count);

await prisma.$disconnect();
