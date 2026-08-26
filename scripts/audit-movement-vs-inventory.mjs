import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ids = [
  "b73ae6a0-a470-416f-b0ea-65c2480c08d5",
  "8559d8cb-350f-4012-ad2f-106c6651473b",
  "c47d9e3f-e62d-475e-9943-0ac56352814d",
  "prod-1",
];

const branchId = "branch-1";
const companyId = (await prisma.branch.findUnique({ where: { id: branchId } }))?.companyId;

const mod = await import("../src/lib/inventory-movement-ledger.ts");

for (const productId of ids) {
  const history = await mod.getProductMovementHistory(branchId, companyId!, productId);
  if (!history) {
    console.log("SKIP", productId);
    continue;
  }
  const inv = await prisma.branchInventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  const serials = await prisma.productSerial.count({
    where: { branchId, productId, status: "available" },
  });
  console.log(`\n=== ${history.productName} ===`);
  console.log("movement header:", history.currentQuantity, "| inv qty:", inv?.quantity, "| serials:", serials);
  for (const e of history.entries) {
    console.log(`  ${e.documentNumber} ${e.type} ${e.direction}${e.quantity} bal=${e.balanceAfter}`);
  }
}

await prisma.$disconnect();
