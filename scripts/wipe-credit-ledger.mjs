/**
 * مسح كل بيانات شاشة الديون والأجل (سجلات + حركات).
 * Usage: node scripts/wipe-credit-ledger.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function wipe() {
  const before = {
    entries: await prisma.creditLedgerEntry.count(),
    payments: await prisma.creditLedgerPayment.count(),
  };

  await prisma.$transaction(async (tx) => {
    await tx.creditLedgerPayment.deleteMany();
    await tx.creditLedgerEntry.deleteMany();
  });

  const after = {
    entries: await prisma.creditLedgerEntry.count(),
    payments: await prisma.creditLedgerPayment.count(),
  };

  console.log("=== Credit ledger wiped ===");
  console.log("Before:", before);
  console.log("After:", after);
}

await wipe();
await prisma.$disconnect();
