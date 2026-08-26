import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const serial = await prisma.productSerial.findFirst({
  where: { imeiEntries: { some: { imei: "1212121212121212121212121" } } },
  include: {
    imeiEntries: true,
    purchaseItem: { include: { product: { select: { id: true, nameAr: true } } } },
    product: { select: { id: true, nameAr: true } },
  },
});

console.log(JSON.stringify(serial, null, 2));

await prisma.$disconnect();
