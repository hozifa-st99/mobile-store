import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const branchId = "branch-1";
const productId = "19d19038-b1f3-44d9-9392-089c751e7cc6";

const stocktakes = await prisma.stocktake.findMany({
  orderBy: { createdAt: "desc" },
  take: 3,
  include: { items: true },
});

for (const st of stocktakes) {
  console.log("\n===", st.documentNumber, st.status, "===");
  for (const item of st.items) {
    console.log(
      "product",
      item.productId.slice(0, 8),
      "sys",
      item.systemQuantity,
      "cnt",
      item.countedQuantity,
      "var",
      item.variance
    );
    if (item.serialsSnapshot) {
      const snaps = JSON.parse(item.serialsSnapshot);
      const absent = snaps.filter((s) => !s.present);
      console.log("  absent in snapshot:", absent.length);
      for (const a of absent) {
        console.log("   ", a.imeis?.join("+"), "id", a.id?.slice(0, 8));
      }
    }
  }
}

const serials = await prisma.productSerial.findMany({
  where: { branchId, productId, status: "available" },
  include: { imeiEntries: true },
});
const inv = await prisma.branchInventory.findUnique({
  where: { branchId_productId: { branchId, productId } },
});
console.log("\navailable serials:", serials.length, "inventory qty:", inv?.quantity);
for (const s of serials) {
  console.log(" ", s.id.slice(0, 8), s.imeiEntries.map((i) => i.imei).join("+"));
}

await prisma.$disconnect();
