import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const serials = await prisma.productSerial.findMany({
  where: { branchId: "branch-1", status: "available" },
  include: {
    imeiEntries: true,
    product: { select: { nameAr: true } },
    purchaseItem: { select: { productId: true, product: { select: { nameAr: true } } } },
    stockEntryItem: { select: { productId: true } },
  },
});

console.log("=== Orphan / mismatched serials ===");
for (const s of serials) {
  const lineProductId = s.purchaseItem?.productId ?? s.stockEntryItem?.productId;
  if (lineProductId && lineProductId !== s.productId) {
    console.log({
      serialId: s.id.slice(0, 8),
      serialProduct: s.product.nameAr,
      serialProductId: s.productId,
      lineProduct: s.purchaseItem?.product?.nameAr,
      lineProductId,
      imei: s.imeiEntries.map((e) => e.imei).join("/"),
      unitCost: s.unitCost,
    });
  }
}

await prisma.$disconnect();
