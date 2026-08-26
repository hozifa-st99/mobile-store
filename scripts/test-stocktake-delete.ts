import { PrismaClient } from "@prisma/client";
import { parseStocktakeSerials } from "../src/lib/stocktake-serial-snapshot";
import { findDeviceSerialByImei } from "../src/lib/product-serial-service";

const prisma = new PrismaClient();
const branchId = "branch-1";
const productId = "19d19038-b1f3-44d9-9392-089c751e7cc6";

async function main() {
  const stocktakes = await prisma.stocktake.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { items: true },
  });

  for (const st of stocktakes) {
    console.log("\n===", st.documentNumber, "===");
    for (const item of st.items) {
      const snaps = parseStocktakeSerials(item.serialsSnapshot);
      const absent = snaps.filter((s) => !s.present);
      console.log("absent devices:", absent.length);
      for (const snap of absent) {
        console.log("  snap id:", snap.id, "imeis:", snap.imeis);
        const byId = await prisma.productSerial.findUnique({ where: { id: snap.id } });
        console.log("  exists by id:", !!byId, byId?.status);
        for (const imei of snap.imeis) {
          const byImei = await findDeviceSerialByImei(prisma, branchId, imei, {
            productId,
            status: "available",
          });
          console.log("  findByImei", imei, "->", byImei?.id?.slice(0, 8) ?? "NOT FOUND");
        }
      }
    }
  }

  const count = await prisma.productSerial.count({
    where: { branchId, productId, status: "available" },
  });
  const inv = await prisma.branchInventory.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  console.log("\navailable serials:", count, "inventory qty:", inv?.quantity);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
