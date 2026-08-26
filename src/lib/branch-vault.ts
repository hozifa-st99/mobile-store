import type { Prisma } from "@prisma/client";

import {
  BRANCH_VAULT_TYPE_LABELS,
  type BranchVaultMovementType,
  type VaultCashSource,
} from "@/lib/branch-vault-types";
import { prisma } from "@/lib/prisma";

export type { BranchVaultMovementType, VaultCashSource } from "@/lib/branch-vault-types";
export {
  BRANCH_VAULT_TYPE_FILTER_OPTIONS,
  BRANCH_VAULT_TYPE_LABELS,
  parseBranchVaultMovementType,
} from "@/lib/branch-vault-types";

type Db = Prisma.TransactionClient | typeof prisma;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function computeBranchVaultBalance(db: Db, branchId: string): Promise<number> {
  const rows = await db.branchVaultMovement.findMany({
    where: { branchId },
    select: { direction: true, amount: true },
  });

  let balance = 0;
  for (const row of rows) {
    balance += row.direction === "in" ? row.amount : -row.amount;
  }
  return roundMoney(balance);
}

export async function recordBranchVaultMovement(
  db: Db,
  data: {
    branchId: string;
    type: BranchVaultMovementType;
    direction: "in" | "out";
    amount: number;
    referenceType?: string | null;
    referenceId?: string | null;
    movementDate?: Date;
    documentNumber?: string | null;
    description: string;
    notes?: string | null;
    createdByUserId?: string | null;
  }
) {
  const amount = roundMoney(data.amount);
  if (amount <= 0) {
    throw new Error("INVALID_VAULT_AMOUNT");
  }

  if (data.direction === "out") {
    const balance = await computeBranchVaultBalance(db, data.branchId);
    if (balance + 0.0001 < amount) {
      throw new Error("INSUFFICIENT_VAULT_BALANCE");
    }
  }

  return db.branchVaultMovement.create({
    data: {
      branchId: data.branchId,
      type: data.type,
      direction: data.direction,
      amount,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      movementDate: data.movementDate ?? new Date(),
      documentNumber: data.documentNumber ?? null,
      description: data.description,
      notes: data.notes ?? null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function depositShiftCashToVault(
  db: Db,
  params: {
    branchId: string;
    shiftId: string;
    shiftNumber: string;
    netAmount: number;
    closedAt: Date;
    userId?: string | null;
  }
) {
  const amount = roundMoney(params.netAmount);
  if (amount <= 0) return null;

  return recordBranchVaultMovement(db, {
    branchId: params.branchId,
    type: "shift_deposit",
    direction: "in",
    amount,
    referenceType: "treasury_shift",
    referenceId: params.shiftId,
    movementDate: params.closedAt,
    documentNumber: params.shiftNumber,
    description: `توريد نقدية وردية ${params.shiftNumber} إلى خزنة الفرع`,
    createdByUserId: params.userId ?? null,
  });
}

async function getOpenShiftPeriodStart(db: Db, branchId: string): Promise<Date> {
  const lastShift = await db.treasuryShift.findFirst({
    where: { branchId },
    orderBy: { closedAt: "desc" },
    select: { closedAt: true },
  });
  return lastShift?.closedAt ?? new Date(0);
}

export async function sumOpenShiftVaultDeposits(db: Db, branchId: string): Promise<number> {
  const since = await getOpenShiftPeriodStart(db, branchId);
  const rows = await db.branchVaultMovement.findMany({
    where: {
      branchId,
      type: "open_shift_deposit",
      direction: "in",
      movementDate: { gt: since },
    },
    select: { amount: true },
  });

  return roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
}

async function allocateOpenShiftDepositNumber(db: Db, branchId: string): Promise<string> {
  const since = await getOpenShiftPeriodStart(db, branchId);
  const count = await db.branchVaultMovement.count({
    where: {
      branchId,
      type: "open_shift_deposit",
      movementDate: { gt: since },
    },
  });
  return `TV-${String(count + 1).padStart(4, "0")}`;
}

export async function listOpenShiftVaultDeposits(db: Db, branchId: string) {
  const since = await getOpenShiftPeriodStart(db, branchId);
  return db.branchVaultMovement.findMany({
    where: {
      branchId,
      type: "open_shift_deposit",
      direction: "in",
      movementDate: { gt: since },
    },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function depositOpenShiftCashToVault(
  db: Db,
  params: {
    branchId: string;
    amount: number;
    userId?: string | null;
    notes?: string | null;
  }
) {
  const amount = roundMoney(params.amount);
  if (amount <= 0) {
    throw new Error("INVALID_VAULT_AMOUNT");
  }

  const documentNumber = await allocateOpenShiftDepositNumber(db, params.branchId);

  return recordBranchVaultMovement(db, {
    branchId: params.branchId,
    type: "open_shift_deposit",
    direction: "in",
    amount,
    referenceType: "open_treasury_shift",
    referenceId: params.branchId,
    documentNumber,
    description: `توريد نقدية من الوردية المفتوحة (${documentNumber}) إلى خزنة الفرع`,
    notes: params.notes ?? null,
    createdByUserId: params.userId ?? null,
  });
}

export interface BranchVaultMovementView {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  movementDate: string;
  documentNumber: string | null;
  description: string;
  notes: string | null;
  detailUrl: string | null;
}

const VAULT_TYPE_LABELS = BRANCH_VAULT_TYPE_LABELS;

function vaultDetailUrl(referenceType: string | null, referenceId: string | null): string | null {
  if (!referenceType || !referenceId) return null;
  if (referenceType === "treasury_shift") return `/dashboard/treasury/deposits?shift=${referenceId}`;
  if (referenceType === "open_treasury_shift") return `/dashboard/treasury`;
  if (referenceType === "purchase") return `/dashboard/purchases/${referenceId}`;
  return null;
}

export async function listBranchVaultMovements(
  branchId: string,
  options?: {
    dateFrom?: string;
    dateTo?: string;
    invoiceNumber?: string;
    type?: BranchVaultMovementType;
    limit?: number;
  }
): Promise<{ balance: number; movements: BranchVaultMovementView[] }> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 200));
  const where: Prisma.BranchVaultMovementWhereInput = { branchId };

  if (options?.dateFrom || options?.dateTo) {
    where.movementDate = {};
    if (options.dateFrom) where.movementDate.gte = new Date(options.dateFrom);
    if (options.dateTo) {
      const end = new Date(options.dateTo);
      end.setHours(23, 59, 59, 999);
      where.movementDate.lte = end;
    }
  }

  const invoiceNumber = options?.invoiceNumber?.trim();
  if (invoiceNumber) {
    where.documentNumber = { contains: invoiceNumber };
  }

  if (options?.type) {
    where.type = options.type;
  }

  const [balance, rows] = await Promise.all([
    computeBranchVaultBalance(prisma, branchId),
    prisma.branchVaultMovement.findMany({
      where,
      orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  return {
    balance,
    movements: rows.map((row) => ({
      id: row.id,
      type: row.type,
      typeLabel: VAULT_TYPE_LABELS[row.type] || row.type,
      direction: row.direction === "in" ? "in" : "out",
      amount: row.amount,
      movementDate: row.movementDate.toISOString(),
      documentNumber: row.documentNumber,
      description: row.description,
      notes: row.notes,
      detailUrl: vaultDetailUrl(row.referenceType, row.referenceId),
    })),
  };
}

export type PurchasePaymentType = "full_cash" | "credit" | "partial_credit";

export function resolvePurchasePayment(input: {
  paymentType: PurchasePaymentType;
  total: number;
  paidAmountInput?: number;
}): { paidAmount: number; creditAmount: number } {
  const total = roundMoney(input.total);
  if (input.paymentType === "full_cash") {
    return { paidAmount: total, creditAmount: 0 };
  }
  if (input.paymentType === "credit") {
    return { paidAmount: 0, creditAmount: total };
  }
  const paid = roundMoney(input.paidAmountInput ?? 0);
  if (paid <= 0 || paid >= total) {
    throw new Error("INVALID_PARTIAL_PAID_AMOUNT");
  }
  return { paidAmount: paid, creditAmount: roundMoney(total - paid) };
}

export function parsePurchasePaymentType(value: unknown): PurchasePaymentType | null {
  if (value === "full_cash" || value === "credit" || value === "partial_credit") return value;
  return null;
}

export function parseCashSource(value: unknown): VaultCashSource | null {
  if (value === "shift" || value === "vault") return value;
  return null;
}
