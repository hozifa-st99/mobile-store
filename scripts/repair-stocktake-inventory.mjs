import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";

function parseStocktakeSerials(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadRemovedImeis(productId) {
  const items = await prisma.stocktakeItem.findMany({
    where: {
      productId,
      stocktake: { branchId, status: "completed" },
    },
    select: { serialsSnapshot: true },
  });
  const removed = new Set();
  for (const item of items) {
    for (const snap of parseStocktakeSerials(item.serialsSnapshot)) {
      if (snap.present) continue;
      for (const imei of snap.imeis ?? []) removed.add(imei);
    }
  }
  return removed;
}

async function findSerialByImei(productId, imei) {
  const entry = await prisma.productSerialImei.findUnique({
    where: { branchId_imei: { branchId, imei } },
    include: { serial: true },
  });
  const serial = entry?.serial;
  if (!serial || serial.productId !== productId || serial.status !== "available") return null;
  return serial;
}

async function reconcileProduct(productId) {
  const lastItem = await prisma.stocktakeItem.findFirst({
    where: {
      productId,
      variance: { not: 0 },
      stocktake: { branchId, status: "completed" },
    },
    orderBy: { stocktake: { createdAt: "desc" } },
    include: { stocktake: true },
  });
  if (!lastItem) return;

  const targetCount = Math.max(0, lastItem.countedQuantity);
  const removedImeis = await loadRemovedImeis(productId);
  const deleted = new Set();

  console.log("\nproduct", productId.slice(0, 8), "target", targetCount, "removed imeis", [...removedImeis]);

  for (const imei of removedImeis) {
    const serial = await findSerialByImei(productId, imei);
    if (!serial || deleted.has(serial.id)) continue;
    await prisma.productSerial.delete({ where: { id: serial.id } });
    deleted.add(serial.id);
    console.log("  deleted by imei", imei, serial.id.slice(0, 8));
  }

  let available = await prisma.productSerial.count({
    where: { branchId, productId, status: "available" },
  });

  if (available > targetCount) {
    const extras = await prisma.productSerial.findMany({
      where: { branchId, productId, status: "available" },
      orderBy: { createdAt: "asc" },
      take: available - targetCount,
      select: { id: true },
    });
    for (const serial of extras) {
      if (deleted.has(serial.id)) continue;
      await prisma.productSerial.delete({ where: { id: serial.id } });
      console.log("  deleted extra", serial.id.slice(0, 8));
    }
  }

  available = await prisma.productSerial.count({
    where: { branchId, productId, status: "available" },
  });
  await prisma.branchInventory.updateMany({
    where: { branchId, productId },
    data: { quantity: available },
  });
  console.log("  synced qty ->", available);
}

const phoneInventories = await prisma.branchInventory.findMany({
  where: { branchId, product: { type: "phone", deletedAt: null } },
  select: { productId: true },
});

for (const { productId } of phoneInventories) {
  await reconcileProduct(productId);
}

await prisma.$disconnect();
