import type { Prisma } from "@prisma/client";

import { compareNewestDocumentFirst } from "@/lib/document-list-sort";
import {
  computeBranchVaultBalance,
  depositOpenShiftCashToVault,
  depositShiftCashToVault,
  listOpenShiftVaultDeposits,
  sumOpenShiftVaultDeposits,
} from "@/lib/branch-vault";
import { prisma } from "@/lib/prisma";
import {
  buildAllTreasuryTransactions,
  computeTreasuryBalance,
  summarizeTreasuryTransactions,
  type TreasurySummary,
  type TreasuryTransaction,
} from "@/lib/treasury-ledger";

type Db = Prisma.TransactionClient | typeof prisma;

export interface OpenShiftView {
  transactions: TreasuryTransaction[];
  summary: TreasurySummary & {
    grossNet: number;
    vaultDeposited: number;
    remainingToDeposit: number;
  };
}

export interface DepositedShiftView {
  transactions: TreasuryTransaction[];
  summary: Pick<TreasurySummary, "totalIn" | "totalOut" | "netInPeriod">;
}

function buildDateRange(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
}

async function getDepositedEntryKeys(db: Db, branchId: string): Promise<Set<string>> {
  const rows = await db.treasuryShiftEntry.findMany({
    where: { shift: { branchId } },
    select: { entryKey: true },
  });
  return new Set(rows.map((row) => row.entryKey));
}

function entryRowToTransaction(row: {
  entryKey: string;
  type: string;
  typeLabel: string;
  direction: string;
  amount: number;
  transactionDate: Date;
  sourceCreatedAt: Date;
  documentNumber: string;
  description: string;
  detailUrl: string;
  paymentMethod: string | null;
}): TreasuryTransaction {
  const direction = row.direction === "in" ? "in" : "out";
  return {
    id: row.entryKey,
    type: row.type as TreasuryTransaction["type"],
    typeLabel: row.typeLabel,
    direction,
    amount: row.amount,
    signedAmount: direction === "in" ? row.amount : -row.amount,
    date: row.transactionDate.toISOString(),
    createdAt: row.sourceCreatedAt.toISOString(),
    documentNumber: row.documentNumber,
    description: row.description,
    detailUrl: row.detailUrl,
    paymentMethod: row.paymentMethod,
  };
}

function openShiftVaultDepositToTransaction(row: {
  id: string;
  amount: number;
  movementDate: Date;
  createdAt: Date;
  documentNumber: string | null;
  description: string;
  notes: string | null;
}): TreasuryTransaction {
  return {
    id: `open-vault-${row.id}`,
    type: "open_shift_deposit",
    typeLabel: "توريد للخزنة",
    direction: "out",
    amount: row.amount,
    signedAmount: -row.amount,
    date: row.movementDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    documentNumber: row.documentNumber || row.id.slice(0, 8),
    description: row.description,
    detailUrl: "/dashboard/treasury/vault",
    paymentMethod: "نقدي",
  };
}

export async function computeOpenShiftCashAvailability(branchId: string): Promise<{
  grossNet: number;
  vaultDeposited: number;
  remainingToDeposit: number;
  pendingEntryCount: number;
}> {
  const [allRows, depositedKeys, vaultDeposited] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    getDepositedEntryKeys(prisma, branchId),
    sumOpenShiftVaultDeposits(prisma, branchId),
  ]);

  const pendingLedger = allRows.filter((row) => !depositedKeys.has(row.id));
  const grossNet = summarizeTreasuryTransactions(pendingLedger).netInPeriod;
  const remainingToDeposit = roundMoney(grossNet - vaultDeposited);

  return {
    grossNet,
    vaultDeposited,
    remainingToDeposit,
    pendingEntryCount: pendingLedger.length,
  };
}

export async function depositOpenShiftToVault(
  branchId: string,
  userId: string | null,
  amount: number,
  notes?: string | null
): Promise<{
  documentNumber: string;
  amount: number;
  vaultDeposited: number;
  remainingToDeposit: number;
  vaultBalance: number;
}> {
  const availability = await computeOpenShiftCashAvailability(branchId);
  if (availability.remainingToDeposit <= 0) {
    throw new Error("NO_AVAILABLE_CASH");
  }

  const roundedAmount = roundMoney(amount);
  if (roundedAmount <= 0) {
    throw new Error("INVALID_VAULT_AMOUNT");
  }
  if (roundedAmount > availability.remainingToDeposit + 0.0001) {
    throw new Error("EXCEEDS_AVAILABLE_CASH");
  }

  return prisma.$transaction(async (tx) => {
    const movement = await depositOpenShiftCashToVault(tx, {
      branchId,
      amount: roundedAmount,
      userId,
      notes,
    });

    const [vaultDeposited, vaultBalance] = await Promise.all([
      sumOpenShiftVaultDeposits(tx, branchId),
      computeBranchVaultBalance(tx, branchId),
    ]);

    return {
      documentNumber: movement.documentNumber || "",
      amount: roundedAmount,
      vaultDeposited,
      remainingToDeposit: roundMoney(availability.grossNet - vaultDeposited),
      vaultBalance,
    };
  });
}

async function allocateShiftNumber(db: Db, branchId: string): Promise<string> {
  const count = await db.treasuryShift.count({ where: { branchId } });
  return `W-${String(count + 1).padStart(4, "0")}`;
}

export async function buildTreasuryShiftView(
  branchId: string,
  options?: { dateFrom?: string; dateTo?: string; depositedLimit?: number }
): Promise<{
  openShift: OpenShiftView;
  deposited: DepositedShiftView;
  currentBalance: number;
}> {
  const dateRange = buildDateRange(options?.dateFrom, options?.dateTo);
  const depositedLimit = Math.min(500, Math.max(1, options?.depositedLimit ?? 300));

  const [allRows, depositedKeys, currentBalance, depositedRows, vaultDepositRows] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    getDepositedEntryKeys(prisma, branchId),
    computeTreasuryBalance(prisma, branchId),
    prisma.treasuryShiftEntry.findMany({
      where: {
        shift: { branchId },
        ...(dateRange ? { transactionDate: dateRange } : {}),
      },
      orderBy: [{ transactionDate: "desc" }, { sourceCreatedAt: "desc" }],
      take: depositedLimit,
    }),
    listOpenShiftVaultDeposits(prisma, branchId),
  ]);

  const pendingLedger = allRows.filter((row) => !depositedKeys.has(row.id));
  const vaultTransactions = vaultDepositRows.map(openShiftVaultDepositToTransaction);
  const pendingDisplay = [...pendingLedger, ...vaultTransactions].sort((a, b) =>
    compareNewestDocumentFirst(a.date, a.createdAt, b.date, b.createdAt)
  );
  const ledgerTotals = summarizeTreasuryTransactions(pendingLedger);
  const pendingTotals = summarizeTreasuryTransactions(pendingDisplay);
  const vaultDeposited = roundMoney(ledgerTotals.netInPeriod - pendingTotals.netInPeriod);
  const depositedTransactions = depositedRows
    .map(entryRowToTransaction)
    .sort((a, b) => compareNewestDocumentFirst(a.date, a.createdAt, b.date, b.createdAt));

  return {
    openShift: {
      transactions: pendingDisplay,
      summary: {
        currentBalance,
        ...pendingTotals,
        grossNet: ledgerTotals.netInPeriod,
        vaultDeposited,
        remainingToDeposit: pendingTotals.netInPeriod,
      },
    },
    deposited: {
      transactions: depositedTransactions,
      summary: summarizeTreasuryTransactions(depositedTransactions),
    },
    currentBalance,
  };
}

export async function closeTreasuryShift(
  branchId: string,
  userId: string | null
): Promise<{ shiftNumber: string; entryCount: number; netAmount: number }> {
  const [allRows, depositedKeys] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    getDepositedEntryKeys(prisma, branchId),
  ]);

  const pending = allRows.filter((row) => !depositedKeys.has(row.id));
  if (pending.length === 0) {
    throw new Error("NO_PENDING_ENTRIES");
  }

  const totals = summarizeTreasuryTransactions(pending);
  const vaultDeposited = await sumOpenShiftVaultDeposits(prisma, branchId);
  const remainingNet = roundMoney(totals.netInPeriod - vaultDeposited);
  const closedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const shiftNumber = await allocateShiftNumber(tx, branchId);
    const shift = await tx.treasuryShift.create({
      data: {
        branchId,
        userId,
        shiftNumber,
        closedAt,
        totalIn: totals.totalIn,
        totalOut: totals.totalOut,
        netAmount: totals.netInPeriod,
        entryCount: pending.length,
      },
    });

    await tx.treasuryShiftEntry.createMany({
      data: pending.map((row) => ({
        shiftId: shift.id,
        entryKey: row.id,
        type: row.type,
        typeLabel: row.typeLabel,
        direction: row.direction,
        amount: row.amount,
        transactionDate: new Date(row.date),
        sourceCreatedAt: new Date(row.createdAt),
        documentNumber: row.documentNumber,
        description: row.description,
        detailUrl: row.detailUrl,
        paymentMethod: row.paymentMethod ?? null,
      })),
    });

    await depositShiftCashToVault(tx, {
      branchId,
      shiftId: shift.id,
      shiftNumber: shift.shiftNumber,
      netAmount: remainingNet,
      closedAt,
      userId,
    });

    return {
      shiftNumber: shift.shiftNumber,
      entryCount: pending.length,
      netAmount: totals.netInPeriod,
      vaultDepositedOnClose: remainingNet,
    };
  });
}

export interface TreasuryShiftListItem {
  id: string;
  shiftNumber: string;
  closedAt: string;
  totalIn: number;
  totalOut: number;
  netAmount: number;
  entryCount: number;
  userName: string | null;
}

export interface TreasuryShiftListSummary {
  count: number;
  totalIn: number;
  totalOut: number;
  netAmount: number;
}

export interface TreasuryShiftEntryDetail {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  documentNumber: string;
  description: string;
  date: string;
  paymentMethod: string | null;
  detailUrl: string;
}

export interface TreasuryShiftTotalsByType {
  sales: number;
  saleReturns: number;
  purchases: number;
  purchaseReturns: number;
  expenseRecovery: number;
  expenses: number;
}

export interface TreasuryShiftDetails {
  shiftNumber: string;
  closedAt: string;
  userName: string | null;
  netSales: number;
  totalCash: number;
  totalExpenses: number;
  totalIn: number;
  totalOut: number;
  entryCount: number;
  totalsByType: TreasuryShiftTotalsByType;
  entries: TreasuryShiftEntryDetail[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function accumulateTotalsByType(
  entries: { type: string; amount: number }[]
): TreasuryShiftTotalsByType {
  const totals: TreasuryShiftTotalsByType = {
    sales: 0,
    saleReturns: 0,
    purchases: 0,
    purchaseReturns: 0,
    expenseRecovery: 0,
    expenses: 0,
  };

  for (const entry of entries) {
    switch (entry.type) {
      case "sale":
        totals.sales += entry.amount;
        break;
      case "sale_return":
        totals.saleReturns += entry.amount;
        break;
      case "purchase":
        totals.purchases += entry.amount;
        break;
      case "purchase_debt_payment":
        totals.purchases += entry.amount;
        break;
      case "purchase_return":
        totals.purchaseReturns += entry.amount;
        break;
      case "purchase_return_expense_recovery":
        totals.expenseRecovery += entry.amount;
        break;
      case "expense":
        totals.expenses += entry.amount;
        break;
    }
  }

  return {
    sales: roundMoney(totals.sales),
    saleReturns: roundMoney(totals.saleReturns),
    purchases: roundMoney(totals.purchases),
    purchaseReturns: roundMoney(totals.purchaseReturns),
    expenseRecovery: roundMoney(totals.expenseRecovery),
    expenses: roundMoney(totals.expenses),
  };
}

export async function getTreasuryShiftDetails(
  branchId: string,
  shiftId: string
): Promise<TreasuryShiftDetails | null> {
  const shift = await prisma.treasuryShift.findFirst({
    where: { id: shiftId, branchId },
    select: {
      shiftNumber: true,
      closedAt: true,
      totalIn: true,
      totalOut: true,
      netAmount: true,
      entryCount: true,
      user: { select: { fullNameAr: true, username: true } },
      entries: {
        select: {
          entryKey: true,
          type: true,
          typeLabel: true,
          direction: true,
          amount: true,
          transactionDate: true,
          documentNumber: true,
          description: true,
          detailUrl: true,
          paymentMethod: true,
        },
        orderBy: [{ transactionDate: "desc" }, { sourceCreatedAt: "desc" }],
      },
    },
  });

  if (!shift) return null;

  const totalsByType = accumulateTotalsByType(shift.entries);
  const netSales = roundMoney(totalsByType.sales - totalsByType.saleReturns);

  return {
    shiftNumber: shift.shiftNumber,
    closedAt: shift.closedAt.toISOString(),
    userName: shift.user?.fullNameAr || shift.user?.username || null,
    netSales,
    totalCash: roundMoney(shift.netAmount),
    totalExpenses: totalsByType.expenses,
    totalIn: roundMoney(shift.totalIn),
    totalOut: roundMoney(shift.totalOut),
    entryCount: shift.entryCount,
    totalsByType,
    entries: shift.entries.map((entry) => ({
      id: entry.entryKey,
      type: entry.type,
      typeLabel: entry.typeLabel,
      direction: entry.direction === "in" ? "in" : "out",
      amount: entry.amount,
      documentNumber: entry.documentNumber,
      description: entry.description,
      date: entry.transactionDate.toISOString(),
      paymentMethod: entry.paymentMethod,
      detailUrl: entry.detailUrl,
    })),
  };
}

/** @deprecated Use getTreasuryShiftDetails */
export type TreasuryShiftBreakdown = Pick<
  TreasuryShiftDetails,
  "shiftNumber" | "closedAt" | "netSales" | "totalCash" | "totalExpenses"
>;

export async function getTreasuryShiftBreakdown(
  branchId: string,
  shiftId: string
): Promise<TreasuryShiftBreakdown | null> {
  const details = await getTreasuryShiftDetails(branchId, shiftId);
  if (!details) return null;
  return {
    shiftNumber: details.shiftNumber,
    closedAt: details.closedAt,
    netSales: details.netSales,
    totalCash: details.totalCash,
    totalExpenses: details.totalExpenses,
  };
}

export async function listTreasuryShifts(
  branchId: string,
  from: Date,
  to: Date
): Promise<{ shifts: TreasuryShiftListItem[]; summary: TreasuryShiftListSummary }> {
  const rows = await prisma.treasuryShift.findMany({
    where: {
      branchId,
      closedAt: { gte: from, lte: to },
    },
    include: {
      user: { select: { fullNameAr: true, username: true } },
    },
    orderBy: { closedAt: "desc" },
  });

  const shifts: TreasuryShiftListItem[] = rows.map((row) => ({
    id: row.id,
    shiftNumber: row.shiftNumber,
    closedAt: row.closedAt.toISOString(),
    totalIn: row.totalIn,
    totalOut: row.totalOut,
    netAmount: row.netAmount,
    entryCount: row.entryCount,
    userName: row.user?.fullNameAr || row.user?.username || null,
  }));

  const summary = shifts.reduce(
    (acc, row) => ({
      count: acc.count + 1,
      totalIn: acc.totalIn + row.totalIn,
      totalOut: acc.totalOut + row.totalOut,
      netAmount: acc.netAmount + row.netAmount,
    }),
    { count: 0, totalIn: 0, totalOut: 0, netAmount: 0 }
  );

  return {
    shifts,
    summary: {
      count: summary.count,
      totalIn: Math.round(summary.totalIn * 100) / 100,
      totalOut: Math.round(summary.totalOut * 100) / 100,
      netAmount: Math.round(summary.netAmount * 100) / 100,
    },
  };
}
