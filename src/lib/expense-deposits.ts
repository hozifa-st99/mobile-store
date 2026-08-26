import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveReportRange } from "@/lib/report-dates";

type Db = typeof prisma;

export interface ExpenseLineRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  notes?: string | null;
  purchaseReturnId?: string | null;
  lineNumber: number;
}

export interface ExpenseDocumentRow {
  id: string;
  invoiceNumber: string;
  paymentMethod: string;
  expenseDate: string;
  notes?: string | null;
  total: number;
  lineCount: number;
  lines: ExpenseLineRow[];
}

export interface DepositedExpenseRow extends ExpenseLineRow {
  invoiceNumber: string;
  documentId: string | null;
  shiftId: string;
  shiftNumber: string;
  depositedAt: string;
}

async function getDepositedEntryKeys(db: Db, branchId: string): Promise<Set<string>> {
  try {
    const rows = await db.treasuryShiftEntry.findMany({
      where: { shift: { branchId } },
      select: { entryKey: true },
    });
    return new Set(rows.map((row) => row.entryKey));
  } catch {
    return new Set();
  }
}

function mapExpenseLine(e: {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: Date;
  paymentMethod: string;
  notes: string | null;
  purchaseReturnId: string | null;
  lineNumber: number;
}): ExpenseLineRow {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount: e.amount,
    expenseDate: e.expenseDate.toISOString(),
    paymentMethod: e.paymentMethod,
    notes: e.notes,
    purchaseReturnId: e.purchaseReturnId,
    lineNumber: e.lineNumber,
  };
}

export async function isExpenseDeposited(branchId: string, expenseId: string): Promise<boolean> {
  const keys = await getDepositedEntryKeys(prisma, branchId);
  return keys.has(expenseId);
}

export async function isExpenseDocumentDeposited(
  branchId: string,
  documentId: string
): Promise<boolean> {
  const [depositedKeys, lines] = await Promise.all([
    getDepositedEntryKeys(prisma, branchId),
    prisma.expense.findMany({
      where: { branchId, documentId },
      select: { id: true },
    }),
  ]);

  return lines.some((line) => depositedKeys.has(line.id));
}

export async function getOpenShiftExpenses(branchId: string): Promise<{
  documents: ExpenseDocumentRow[];
  total: number;
  documentCount: number;
  lineCount: number;
}> {
  const depositedKeys = await getDepositedEntryKeys(prisma, branchId);
  const depositedList = Array.from(depositedKeys);

  const documents = await prisma.expenseDocument.findMany({
    where: {
      branchId,
      expenses: {
        some: {
          ...(depositedList.length > 0 ? { id: { notIn: depositedList } } : {}),
        },
      },
    },
    include: {
      expenses: {
        where: {
          ...(depositedList.length > 0 ? { id: { notIn: depositedList } } : {}),
        },
        orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });

  const rows: ExpenseDocumentRow[] = documents
    .filter((doc) => doc.expenses.length > 0)
    .map((doc) => {
      const lines = doc.expenses.map(mapExpenseLine);
      const total = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
      return {
        id: doc.id,
        invoiceNumber: doc.invoiceNumber,
        paymentMethod: doc.paymentMethod,
        expenseDate: doc.expenseDate.toISOString(),
        notes: doc.notes,
        total,
        lineCount: lines.length,
        lines,
      };
    });

  const total = Math.round(rows.reduce((sum, doc) => sum + doc.total, 0) * 100) / 100;
  const lineCount = rows.reduce((sum, doc) => sum + doc.lineCount, 0);

  return {
    documents: rows,
    total,
    documentCount: rows.length,
    lineCount,
  };
}

export async function listDepositedExpenses(
  branchId: string,
  params: {
    period?: string | null;
    from?: string | null;
    to?: string | null;
    month?: string | null;
    shiftId?: string | null;
  }
): Promise<{
  range: { label: string };
  expenses: DepositedExpenseRow[];
  total: number;
  count: number;
  shifts: { id: string; shiftNumber: string; closedAt: string }[];
}> {
  const range = resolveReportRange(params);
  const from = new Date(range.from);
  const to = new Date(range.to);

  const where: Prisma.TreasuryShiftEntryWhereInput = {
    type: "expense",
    shift: { branchId },
    transactionDate: { gte: from, lte: to },
    ...(params.shiftId ? { shiftId: params.shiftId } : {}),
  };

  const [entries, shifts] = await Promise.all([
    prisma.treasuryShiftEntry.findMany({
      where,
      include: {
        shift: { select: { id: true, shiftNumber: true, closedAt: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { sourceCreatedAt: "desc" }],
      take: 500,
    }),
    prisma.treasuryShift.findMany({
      where: { branchId },
      select: { id: true, shiftNumber: true, closedAt: true },
      orderBy: { closedAt: "desc" },
      take: 100,
    }),
  ]);

  const expenseIds = entries.map((e) => e.entryKey);
  const expenseRows =
    expenseIds.length > 0
      ? await prisma.expense.findMany({
          where: { id: { in: expenseIds }, branchId },
          select: {
            id: true,
            documentId: true,
            invoiceNumber: true,
            lineNumber: true,
            category: true,
            description: true,
            amount: true,
            expenseDate: true,
            paymentMethod: true,
            notes: true,
            purchaseReturnId: true,
          },
        })
      : [];

  const expenseById = new Map(expenseRows.map((e) => [e.id, e]));

  const expenses: DepositedExpenseRow[] = entries.map((entry) => {
    const expense = expenseById.get(entry.entryKey);
    return {
      id: entry.entryKey,
      documentId: expense?.documentId ?? null,
      invoiceNumber: expense?.invoiceNumber ?? entry.documentNumber,
      lineNumber: expense?.lineNumber ?? 1,
      category: expense?.category ?? "other",
      description: expense?.description ?? entry.description,
      amount: entry.amount,
      expenseDate: entry.transactionDate.toISOString(),
      paymentMethod: expense?.paymentMethod ?? entry.paymentMethod ?? "cash",
      notes: expense?.notes ?? null,
      purchaseReturnId: expense?.purchaseReturnId ?? null,
      shiftId: entry.shift.id,
      shiftNumber: entry.shift.shiftNumber,
      depositedAt: entry.shift.closedAt.toISOString(),
    };
  });

  const total = Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  return {
    range,
    expenses,
    total,
    count: expenses.length,
    shifts: shifts.map((s) => ({
      id: s.id,
      shiftNumber: s.shiftNumber,
      closedAt: s.closedAt.toISOString(),
    })),
  };
}
