/**
 * ترحيل IMEI: legacy → imeiEntries + دمج + مزامنة الكميات
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateLegacyImeis() {
  let legacySerials = [];
  try {
    legacySerials = await prisma.$queryRaw`
      SELECT id, branch_id AS branchId, imei
      FROM product_serials
      WHERE imei IS NOT NULL AND TRIM(imei) != ''
    `;
  } catch {
    console.log("Legacy imei column not found — skip legacy copy");
    return;
  }

  console.log(`Legacy serials with imei column: ${legacySerials.length}`);

  for (const row of legacySerials) {
    const imei = String(row.imei || "").trim();
    if (!imei) continue;

    const exists = await prisma.productSerialImei.findUnique({
      where: { branchId_imei: { branchId: row.branchId, imei } },
    });
    if (exists) continue;

    try {
      await prisma.productSerialImei.create({
        data: {
          branchId: row.branchId,
          serialId: row.id,
          imei,
        },
      });
    } catch {
      console.warn("Skip duplicate entry for serial", row.id, imei);
    }
  }

  try {
    const cleared = await prisma.$executeRaw`
      UPDATE product_serials SET imei = NULL WHERE imei IS NOT NULL
    `;
    console.log(`Cleared legacy imei column on ${cleared} rows`);
  } catch {
    console.log("Legacy imei column already removed");
  }
}

async function mergeByField(field) {
  const groups = await prisma.productSerial.groupBy({
    by: [field],
    where: { [field]: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  for (const group of groups) {
    const linkId = group[field];
    if (!linkId) continue;

    const serials = await prisma.productSerial.findMany({
      where: { [field]: linkId },
      include: { imeiEntries: true },
      orderBy: { createdAt: "asc" },
    });

    if (serials.length <= 1) continue;

    const keeper = serials[0];
    for (const extra of serials.slice(1)) {
      for (const entry of extra.imeiEntries) {
        const exists = await prisma.productSerialImei.findUnique({
          where: { branchId_imei: { branchId: entry.branchId, imei: entry.imei } },
        });
        if (!exists) {
          await prisma.productSerialImei.create({
            data: {
              branchId: entry.branchId,
              serialId: keeper.id,
              imei: entry.imei,
            },
          });
        }
      }
      await prisma.productSerial.delete({ where: { id: extra.id } });
      console.log(`Merged ${extra.id} -> ${keeper.id} (${field}=${linkId})`);
    }
  }
}

async function syncPhoneInventoryQuantities() {
  const phoneInventories = await prisma.branchInventory.findMany({
    where: { product: { type: "phone" } },
    select: { id: true, branchId: true, productId: true, quantity: true },
  });

  let fixed = 0;
  for (const inv of phoneInventories) {
    const availableCount = await prisma.productSerial.count({
      where: {
        branchId: inv.branchId,
        productId: inv.productId,
        status: "available",
      },
    });

    if (availableCount !== inv.quantity) {
      await prisma.branchInventory.update({
        where: { id: inv.id },
        data: { quantity: availableCount },
      });
      fixed++;
      console.log(
        `Synced ${inv.productId} @ ${inv.branchId}: ${inv.quantity} -> ${availableCount}`
      );
    }
  }

  console.log(`Inventory sync complete (${fixed} updated)`);
}

async function main() {
  await migrateLegacyImeis();
  await mergeByField("purchaseItemId");
  await mergeByField("stockEntryItemId");
  await syncPhoneInventoryQuantities();
  console.log("Migration complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
