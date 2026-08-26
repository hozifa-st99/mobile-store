import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dump(name) {
  const product = await prisma.product.findFirst({
    where: { nameAr: { contains: name } },
  });
  if (!product) {
    console.log("NOT FOUND:", name);
    return;
  }

  console.log("\n==========", product.nameAr, product.id, "==========");
  const inv = await prisma.branchInventory.findFirst({ where: { productId: product.id } });
  console.log("inventory qty:", inv?.quantity);

  const serials = await prisma.productSerial.findMany({
    where: { productId: product.id },
    include: {
      imeiEntries: true,
      purchaseItem: { include: { purchase: { select: { invoiceNumber: true } } } },
      stockEntryItem: { include: { stockEntry: { select: { documentNumber: true } } } },
    },
  });
  console.log("serials:", serials.length);
  for (const s of serials) {
    console.log(" ", s.status, s.imeiEntries.map((e) => e.imei).join("/"), "pur:", s.purchaseItem?.purchase?.invoiceNumber, "stk:", s.stockEntryItem?.stockEntry?.documentNumber);
  }

  const stk = await prisma.stockEntryItem.findMany({
    where: { productId: product.id },
    include: { stockEntry: { select: { documentNumber: true, status: true } } },
  });
  console.log("stock entries:", stk.length);
  for (const s of stk) console.log(" ", s.stockEntry.documentNumber, s.stockEntry.status, "qty", s.quantity);

  const sales = await prisma.saleItem.findMany({
    where: { productId: product.id },
    include: { sale: { select: { invoiceNumber: true, status: true, saleDate: true } } },
  });
  console.log("sales:", sales.length);
  for (const s of sales) console.log(" ", s.sale.invoiceNumber, s.sale.status, s.sale.saleDate.toISOString().slice(0, 10), "qty", s.quantity);

  const st = await prisma.stocktakeItem.findMany({
    where: { productId: product.id },
    include: { stocktake: { select: { documentNumber: true, status: true } } },
  });
  console.log("stocktakes:", st.length);
  for (const s of st) console.log(" ", s.stocktake.documentNumber, "sys", s.systemQuantity, "counted", s.countedQuantity, "var", s.variance);
}

await dump("iPhone 15 Pro Max");
await dump("iPhone 14");
await prisma.$disconnect();
