import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBranchCode } from "@/lib/branch-code";
import {
  formatPurchaseInvoiceNumber,
  parsePurchaseInvoiceSeq,
} from "@/lib/purchase-invoice-number";

type Db = Prisma.TransactionClient | typeof prisma;

async function readBranchCodeColumn(
  db: Db,
  branchId: string
): Promise<string | null> {
  try {
    const rows = await db.$queryRaw<{ code: string | null }[]>`
      SELECT code FROM branches WHERE id = ${branchId} LIMIT 1
    `;
    const raw = rows[0]?.code?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

async function getBranchCode(db: Db, branchId: string): Promise<string> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");

  const code = await readBranchCodeColumn(db, branchId);
  return resolveBranchCode({ code, id: branch.id });
}

export async function getMaxPurchaseInvoiceSeq(
  db: Db,
  branchId: string,
  branchCode?: string
): Promise<number> {
  const code = branchCode ?? (await getBranchCode(db, branchId));
  const rows = await db.purchase.findMany({
    where: { branchId },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const row of rows) {
    const seq = parsePurchaseInvoiceSeq(row.invoiceNumber, code);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

export async function getNextPurchaseInvoiceNumber(
  db: Db,
  branchId: string
): Promise<string> {
  const branchCode = await getBranchCode(db, branchId);
  const maxSeq = await getMaxPurchaseInvoiceSeq(db, branchId, branchCode);
  return formatPurchaseInvoiceNumber(branchCode, maxSeq + 1);
}

export async function allocatePurchaseInvoiceNumber(
  db: Db,
  branchId: string,
  requested?: string
): Promise<string> {
  const branchCode = await getBranchCode(db, branchId);
  const trimmed = requested?.trim();

  if (trimmed) {
    const exists = await db.purchase.findFirst({
      where: { branchId, invoiceNumber: trimmed },
      select: { id: true },
    });
    if (!exists) return trimmed;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await getNextPurchaseInvoiceNumber(db, branchId);
    const exists = await db.purchase.findFirst({
      where: { branchId, invoiceNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  throw new Error("INVOICE_NUMBER_ALLOCATE_FAILED");
}
