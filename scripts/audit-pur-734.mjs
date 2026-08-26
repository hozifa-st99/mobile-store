import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const purchase = await prisma.purchase.findFirst({
  where: { invoiceNumber: "PUR-MAD-00740534" },
  include: {
    items: {
      include: {
        product: { select: { id: true, nameAr: true, type: true, deletedAt: true } },
        serials: { include: { imeiEntries: true } },
      },
    },
    branch: { select: { id: true, nameAr: true } },
  },
});

console.log("=== Purchase PUR-MAD-00740534 ===");
if (!purchase) {
  console.log("NOT FOUND");
} else {
  console.log("id:", purchase.id);
  console.log("branch:", purchase.branch.nameAr, purchase.branchId);
  console.log("status:", purchase.status);
  for (const item of purchase.items) {
    console.log("\n--- Item ---");
    console.log("product:", item.product.nameAr, item.productId);
    console.log("product deleted:", item.product.deletedAt);
    console.log("qty:", item.quantity);
    console.log("imeisSnapshot:", item.imeisSnapshot);
    console.log("serials:", item.serials.length);
    for (const s of item.serials) {
      console.log(
        "  serial",
        s.id.slice(0, 8),
        "status:",
        s.status,
        "productId:",
        s.productId,
        "branch:",
        s.branchId,
        "imei:",
        s.imeiEntries.map((e) => e.imei).join("/")
      );
    }
    const inv = await prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId: purchase.branchId, productId: item.productId } },
    });
    console.log("branchInventory:", inv ? { qty: inv.quantity, id: inv.id } : "MISSING");
  }
}

// Find iPhone 15 Pro Max products
const iphones = await prisma.product.findMany({
  where: { nameAr: { contains: "iPhone 15 Pro Max" } },
  include: { inventories: true },
});
console.log("\n=== All iPhone 15 Pro Max products ===");
for (const p of iphones) {
  console.log(p.id, p.nameAr, "deleted:", p.deletedAt, "inventories:", p.inventories.map((i) => i.quantity));
}

await prisma.$disconnect();
