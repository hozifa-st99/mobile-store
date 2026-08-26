import type { Prisma } from "@prisma/client";

import { resolveBranchCode } from "@/lib/branch-code";
import {
  EXP_INVOICE_PREFIX,
  formatExpenseInvoiceNumber,
  parseExpenseInvoiceSeq,
} from "@/lib/expense-invoice-number";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

async function readBranchCodeColumn(
  db: Db,
  branchId: string
): Promise<string | null> {
  try {
    const rows = await db.$queryRaw<{ code: string | null }[]>`
      SELECT code FROM branches WHERE id = ${branchId} LIMIT 1
    `;
    return rows[0]?.code?.trim() || null;
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

export async function getMaxExpenseInvoiceSeq(
  db: Db,
  branchId: string,
  branchCode?: string
): Promise<number> {
  const code = branchCode ?? (await getBranchCode(db, branchId));
  const rows = await db.expenseDocument.findMany({
    where: { branchId },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const row of rows) {
    const seq = parseExpenseInvoiceSeq(row.invoiceNumber, code);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

export async function allocateExpenseInvoiceNumber(
  db: Db,
  branchId: string
): Promise<string> {
  const branchCode = await getBranchCode(db, branchId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const maxSeq = await getMaxExpenseInvoiceSeq(db, branchId, branchCode);
    const candidate = formatExpenseInvoiceNumber(branchCode, maxSeq + 1 + attempt);
    const exists = await db.expenseDocument.findFirst({
      where: { branchId, invoiceNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `${EXP_INVOICE_PREFIX}${branchCode}-${Date.now()}`;
}
