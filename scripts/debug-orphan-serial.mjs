import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const serial = await prisma.productSerial.findFirst({
  where: { purchaseItemId: "21407553-9819-48c0-9b8a-58f291dc02dc" },
  include: { purchaseItem: { include: { purchase: true } } },
});
console.log(serial?.purchaseItem?.purchase?.invoiceNumber, serial?.status);

await prisma.$disconnect();
