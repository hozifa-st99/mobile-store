import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const productId = "c47d9e3f-e62d-475e-9943-0ac56352814d";

const serials = await prisma.productSerial.findMany({
  where: { productId },
  select: { status: true, purchaseItemId: true, branchId: true },
});
console.log("Total serials:", serials.length, serials);

const inv = await prisma.branchInventory.findFirst({ where: { productId } });
console.log("Inventory qty:", inv?.quantity, "branch:", inv?.branchId);

await prisma.$disconnect();
