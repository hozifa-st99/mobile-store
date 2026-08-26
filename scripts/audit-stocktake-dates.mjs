import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "b73ae6a0-a470-416f-b0ea-65c2480c08d5";

const items = await prisma.stocktakeItem.findMany({
  where: { productId },
  include: {
    stocktake: {
      select: {
        id: true,
        documentNumber: true,
        stocktakeDate: true,
        createdAt: true,
        mode: true,
        status: true,
        user: { select: { fullNameAr: true, username: true } },
      },
    },
  },
  orderBy: { stocktake: { createdAt: "asc" } },
});

console.log("=== Stocktakes for iPhone 14 ===\n");
for (const item of items) {
  const st = item.stocktake;
  console.log(st.documentNumber);
  console.log("  status:", st.status);
  console.log("  mode:", st.mode);
  console.log("  user:", st.user?.fullNameAr || st.user?.username);
  console.log("  stocktakeDate:", st.stocktakeDate.toISOString());
  console.log("  createdAt:", st.createdAt.toISOString());
  console.log("  sys/counted/var:", item.systemQuantity, item.countedQuantity, item.variance);
  console.log("  imei:", item.imeiSnapshot);
  console.log("");
}

const allStk = await prisma.stocktake.findMany({
  where: { status: "completed" },
  select: { documentNumber: true, stocktakeDate: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
console.log("=== All completed stocktakes in branch ===");
for (const s of allStk) {
  console.log(s.documentNumber, "date", s.stocktakeDate.toISOString(), "created", s.createdAt.toISOString());
}

await prisma.$disconnect();
