import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBranchCode } from "@/lib/branch-code";
import {
  formatStocktakeDocumentNumber,
  parseStocktakeDocumentSeq,
} from "@/lib/stocktake-document-number";

type Db = Prisma.TransactionClient | typeof prisma;

async function readBranchCodeColumn(db: Db, branchId: string): Promise<string | null> {
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

export async function getMaxStocktakeDocumentSeq(
  db: Db,
  branchId: string,
  branchCode?: string
): Promise<number> {
  const code = branchCode ?? (await getBranchCode(db, branchId));

  try {
    const rows = await db.stocktake.findMany({
      where: { branchId },
      select: { documentNumber: true },
    });
    let maxSeq = 0;
    for (const row of rows) {
      const seq = parseStocktakeDocumentSeq(row.documentNumber, code);
      if (seq != null && seq > maxSeq) maxSeq = seq;
    }
    return maxSeq;
  } catch {
    const rows = await db.$queryRaw<{ document_number: string }[]>`
      SELECT document_number FROM stocktakes WHERE branch_id = ${branchId}
    `;
    let maxSeq = 0;
    for (const row of rows) {
      const seq = parseStocktakeDocumentSeq(row.document_number, code);
      if (seq != null && seq > maxSeq) maxSeq = seq;
    }
    return maxSeq;
  }
}

export async function getNextStocktakeDocumentNumber(
  db: Db,
  branchId: string
): Promise<string> {
  const branchCode = await getBranchCode(db, branchId);
  const maxSeq = await getMaxStocktakeDocumentSeq(db, branchId, branchCode);
  return formatStocktakeDocumentNumber(branchCode, maxSeq + 1);
}

export async function allocateStocktakeDocumentNumber(
  db: Db,
  branchId: string,
  requested?: string
): Promise<string> {
  const trimmed = requested?.trim();

  if (trimmed) {
    try {
      const exists = await db.stocktake.findFirst({
        where: { branchId, documentNumber: trimmed },
        select: { id: true },
      });
      if (!exists) return trimmed;
    } catch {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM stocktakes
        WHERE branch_id = ${branchId} AND document_number = ${trimmed}
        LIMIT 1
      `;
      if (rows.length === 0) return trimmed;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await getNextStocktakeDocumentNumber(db, branchId);
    try {
      const exists = await db.stocktake.findFirst({
        where: { branchId, documentNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    } catch {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM stocktakes
        WHERE branch_id = ${branchId} AND document_number = ${candidate}
        LIMIT 1
      `;
      if (rows.length === 0) return candidate;
    }
  }

  throw new Error("DOCUMENT_NUMBER_ALLOCATE_FAILED");
}
