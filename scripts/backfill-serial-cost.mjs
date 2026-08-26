import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const serials = await prisma.productSerial.findMany({
  include: {
    imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
  },
});

let updated = 0;

for (const s of serials) {
  const imeis = s.imeiEntries.map((entry) => entry.imei);
  if (imeis.length === 0) continue;

  let line = null;
  for (const imei of imeis) {
    const lines = await prisma.purchaseItem.findMany({
      where: { productId: s.productId, imeisSnapshot: { contains: imei } },
      include: { purchase: { select: { branchId: true, purchaseDate: true } } },
    });

    line =
      lines.find((row) => row.purchase.branchId === s.branchId) ??
      lines.sort((a, b) => b.purchase.purchaseDate - a.purchase.purchaseDate)[0];

    if (line) break;
  }

  if (!line) continue;

  const lineBarcode = line.barcode?.trim() || s.barcode?.trim() || null;

  await prisma.productSerial.update({
    where: { id: s.id },
    data: {
      purchaseItemId: line.id,
      unitCost: line.unitPrice,
      barcode: lineBarcode,
    },
  });
  updated++;
}

console.log(`Updated ${updated} of ${serials.length} serials`);
await prisma.$disconnect();
