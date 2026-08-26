import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";

const serials = await prisma.productSerial.findMany({
  where: {
    branchId,
    OR: [{ purchaseItemId: { not: null } }, { stockEntryItemId: { not: null } }],
  },
  include: {
    purchaseItem: { select: { productId: true, unitPrice: true, retailPrice: true } },
    stockEntryItem: { select: { productId: true, unitPrice: true, retailPrice: true } },
  },
});

const affected = new Set();

for (const serial of serials) {
  const lineProductId =
    serial.purchaseItem?.productId ?? serial.stockEntryItem?.productId ?? null;
  if (!lineProductId || lineProductId === serial.productId) continue;

  const line = serial.purchaseItem ?? serial.stockEntryItem;
  console.log("Fixing serial", serial.id.slice(0, 8), serial.productId.slice(0, 8), "->", lineProductId.slice(0, 8));

  await prisma.productSerial.update({
    where: { id: serial.id },
    data: {
      productId: lineProductId,
      unitCost: line?.unitPrice ?? serial.unitCost,
      retailPrice: line?.retailPrice ?? serial.retailPrice,
    },
  });

  affected.add(serial.productId);
  affected.add(lineProductId);
}

for (const productId of affected) {
  const count = await prisma.productSerial.count({
    where: { branchId, productId, status: "available" },
  });
  await prisma.branchInventory.updateMany({
    where: { branchId, productId },
    data: { quantity: count },
  });
}

for (const pid of ["8559d8cb-350f-4012-ad2f-106c6651473b", "c47d9e3f-e62d-475e-9943-0ac56352814d"]) {
  const inv = await prisma.branchInventory.findFirst({ where: { productId: pid } });
  const product = await prisma.product.findUnique({ where: { id: pid }, select: { nameAr: true } });
  console.log(product?.nameAr, "qty", inv?.quantity);
}

await prisma.$disconnect();
