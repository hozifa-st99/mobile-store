import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBranchCode } from "@/lib/branch-code";
import {
  formatPurchaseReturnNumber,
  parsePurchaseReturnSeq,
} from "@/lib/purchase-return-number";
import { readReturnNumbersRaw, returnNumberExistsRaw } from "@/lib/purchase-return-db";

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

export async function getMaxPurchaseReturnSeq(
  db: Db,
  branchId: string,
  branchCode?: string
): Promise<number> {
  const code = branchCode ?? (await getBranchCode(db, branchId));
  const numbers = await readReturnNumbersRaw(db, branchId);

  let maxSeq = 0;
  for (const returnNumber of numbers) {
    const seq = parsePurchaseReturnSeq(returnNumber, code);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

export async function getNextPurchaseReturnNumber(
  db: Db,
  branchId: string
): Promise<string> {
  const branchCode = await getBranchCode(db, branchId);
  const maxSeq = await getMaxPurchaseReturnSeq(db, branchId, branchCode);
  return formatPurchaseReturnNumber(branchCode, maxSeq + 1);
}

export async function allocatePurchaseReturnNumber(
  db: Db,
  branchId: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await getNextPurchaseReturnNumber(db, branchId);
    const exists = await returnNumberExistsRaw(db, branchId, candidate);
    if (!exists) return candidate;
  }
  throw new Error("RETURN_NUMBER_ALLOCATE_FAILED");
}
