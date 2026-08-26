import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const inv = await p.branchInventory.findMany({ where: { product: { type: "phone" } }, include: { product: { select: { nameAr: true } } }, take: 5 });
  console.log("inventory:", inv.map(i => ({ name: i.product.nameAr, qty: i.quantity, productId: i.productId })));
  const serials = await p.productSerial.findMany({ where: { status: "available" }, include: { imeiEntries: true }, take: 20 });
  console.log("available serials:", serials.length);
  for (const s of serials.slice(0, 8)) {
    console.log({ id: s.id.slice(0,8), productId: s.productId.slice(0,8), imeis: s.imeiEntries.map(e=>e.imei), cost: s.unitCost });
  }
  const last = await p.stocktake.findFirst({ orderBy: { createdAt: "desc" }, include: { items: true } });
  console.log("last stocktake:", last?.documentNumber, "variance:", last?.totalVariance, "items:", last?.items?.length);
  if (last?.items?.[0]) console.log("serialsSnapshot:", last.items[0].serialsSnapshot?.slice(0,200));
}
main().finally(() => p.$disconnect());
