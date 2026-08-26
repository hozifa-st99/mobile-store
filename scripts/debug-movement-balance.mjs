import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function computeBalance(branchId, productId, productType) {
  const isPhone = productType === "phone";

  const serialCountByStockEntryItem = new Map();
  const serialCountByPurchaseItem = new Map();
  if (isPhone) {
    const serials = await prisma.productSerial.findMany({
      where: { branchId, productId },
      select: { purchaseItemId: true, stockEntryItemId: true },
    });
    for (const serial of serials) {
      if (serial.stockEntryItemId) {
        serialCountByStockEntryItem.set(
          serial.stockEntryItemId,
          (serialCountByStockEntryItem.get(serial.stockEntryItemId) ?? 0) + 1
        );
      }
      if (serial.purchaseItemId) {
        serialCountByPurchaseItem.set(
          serial.purchaseItemId,
          (serialCountByPurchaseItem.get(serial.purchaseItemId) ?? 0) + 1
        );
      }
    }
  }

  const inboundQty = (lineId, source, lineQuantity) => {
    if (!isPhone) return lineQuantity;
    const fromSerials =
      source === "stock_entry"
        ? serialCountByStockEntryItem.get(lineId)
        : serialCountByPurchaseItem.get(lineId);
    return fromSerials && fromSerials > 0 ? fromSerials : lineQuantity;
  };

  const raw = [];

  const stockEntryItems = await prisma.stockEntryItem.findMany({
    where: { productId, stockEntry: { branchId, status: "completed" } },
    select: {
      id: true,
      quantity: true,
      stockEntry: { select: { entryDate: true, createdAt: true } },
    },
  });
  for (const item of stockEntryItems) {
    raw.push({
      type: "stock_entry",
      qty: inboundQty(item.id, "stock_entry", item.quantity),
      dir: 1,
      date: item.stockEntry.entryDate,
      createdAt: item.stockEntry.createdAt,
    });
  }

  const purchaseItems = await prisma.purchaseItem.findMany({
    where: { productId, purchase: { branchId, status: "completed" } },
    select: {
      id: true,
      quantity: true,
      purchase: { select: { purchaseDate: true, createdAt: true } },
    },
  });
  for (const item of purchaseItems) {
    raw.push({
      type: "purchase",
      qty: inboundQty(item.id, "purchase", item.quantity),
      dir: 1,
      date: item.purchase.purchaseDate,
      createdAt: item.purchase.createdAt,
    });
  }

  const purchaseReturnItems = await prisma.purchaseReturnItem.findMany({
    where: { productId, purchaseReturn: { branchId } },
    select: {
      quantity: true,
      purchaseReturn: { select: { returnDate: true, createdAt: true } },
    },
  });
  for (const item of purchaseReturnItems) {
    raw.push({
      type: "purchase_return",
      qty: item.quantity,
      dir: -1,
      date: item.purchaseReturn.returnDate,
      createdAt: item.purchaseReturn.createdAt,
    });
  }

  const saleItems = await prisma.saleItem.findMany({
    where: { productId, sale: { branchId, status: "completed" } },
    select: {
      quantity: true,
      sale: { select: { saleDate: true, createdAt: true } },
    },
  });
  for (const item of saleItems) {
    raw.push({
      type: "sale",
      qty: item.quantity,
      dir: -1,
      date: item.sale.saleDate,
      createdAt: item.sale.createdAt,
    });
  }

  const saleReturnItems = await prisma.saleReturnItem.findMany({
    where: { productId, saleReturn: { branchId } },
    select: {
      quantity: true,
      saleReturn: { select: { returnDate: true, createdAt: true } },
    },
  });
  for (const item of saleReturnItems) {
    raw.push({
      type: "sale_return",
      qty: item.quantity,
      dir: 1,
      date: item.saleReturn.returnDate,
      createdAt: item.saleReturn.createdAt,
    });
  }

  const stocktakeItems = await prisma.stocktakeItem.findMany({
    where: { productId, variance: { not: 0 }, stocktake: { branchId, status: "completed" } },
    select: {
      variance: true,
      countedQuantity: true,
      stocktake: { select: { stocktakeDate: true, createdAt: true } },
    },
  });
  for (const item of stocktakeItems) {
    raw.push({
      type: "stocktake",
      qty: Math.abs(item.variance),
      dir: item.variance > 0 ? 1 : -1,
      counted: item.countedQuantity,
      date: item.stocktake.stocktakeDate,
      createdAt: item.stocktake.createdAt,
    });
  }

  raw.sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    if (d !== 0) return d;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let balance = 0;
  for (const row of raw) {
    if (row.type === "stocktake" && row.counted != null) {
      balance = row.counted;
    } else {
      balance += row.dir * row.qty;
    }
  }

  const availableSerials = isPhone
    ? await prisma.productSerial.count({
        where: { branchId, productId, status: "available" },
      })
    : null;

  return { balance, rawCount: raw.length, availableSerials, movements: raw };
}

try {
  const inventories = await prisma.branchInventory.findMany({
    include: { product: { select: { nameAr: true, type: true } } },
    take: 50,
  });

  const mismatches = [];
  for (const inv of inventories) {
    const { balance, availableSerials, rawCount } = await computeBalance(
      inv.branchId,
      inv.productId,
      inv.product.type
    );
    const expected = inv.product.type === "phone" ? availableSerials : inv.quantity;
    if (balance !== expected) {
      mismatches.push({
        name: inv.product.nameAr,
        type: inv.product.type,
        dbQty: inv.quantity,
        ledgerBalance: balance,
        expected,
        movements: rawCount,
      });
    }
  }

  console.log(JSON.stringify(mismatches, null, 2));
  console.log(`Checked ${inventories.length}, mismatches: ${mismatches.length}`);
} finally {
  await prisma.$disconnect();
}
