/**
 * مزامنة branchInventory.quantity = عدد serials المتاحة للموبايلات
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const phoneInventories = await prisma.branchInventory.findMany({
  where: { product: { type: "phone" } },
  select: { id: true, branchId: true, productId: true, quantity: true },
});

let fixed = 0;

for (const inv of phoneInventories) {
  const availableCount = await prisma.productSerial.count({
    where: {
      branchId: inv.branchId,
      productId: inv.productId,
      status: "available",
    },
  });

  if (availableCount !== inv.quantity) {
    await prisma.branchInventory.update({
      where: { id: inv.id },
      data: { quantity: availableCount },
    });
    fixed++;
    console.log(
      `Synced product ${inv.productId} branch ${inv.branchId}: ${inv.quantity} -> ${availableCount}`
    );
  }
}

console.log(`Done. ${fixed} of ${phoneInventories.length} phone inventories updated.`);
await prisma.$disconnect();
