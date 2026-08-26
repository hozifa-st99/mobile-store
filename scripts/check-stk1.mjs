import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const st = await prisma.stocktake.findFirst({
  where: { documentNumber: "STK-MAD-00000001" },
  include: { items: { include: { product: { select: { nameAr: true } } } } },
});
console.log(JSON.stringify(st, null, 2));

await prisma.$disconnect();
