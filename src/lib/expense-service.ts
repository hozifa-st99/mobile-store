import type { Prisma } from "@prisma/client";

import { allocateExpenseInvoiceNumber } from "@/lib/expense-invoice-number-server";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ExpenseLineInput {
  category: string;
  description: string;
  amount: number;
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function createExpenseDocument(
  db: Db,
  branchId: string,
  input: {
    paymentMethod?: string;
    expenseDate?: Date;
    notes?: string | null;
    lines: ExpenseLineInput[];
    purchaseReturnId?: string | null;
  }
) {
  if (!input.lines.length) throw new Error("NO_LINES");

  for (const line of input.lines) {
    if (!line.category || !line.description?.trim() || !Number.isFinite(line.amount)) {
      throw new Error("INVALID_LINE");
    }
    if (line.amount <= 0) throw new Error("INVALID_AMOUNT");
  }

  const expenseDate = input.expenseDate ?? new Date();
  const paymentMethod = input.paymentMethod || "cash";

  return db.$transaction(async (tx) => {
    const invoiceNumber = await allocateExpenseInvoiceNumber(tx, branchId);
    const document = await tx.expenseDocument.create({
      data: {
        branchId,
        invoiceNumber,
        paymentMethod,
        expenseDate,
        notes: input.notes?.trim() || null,
      },
    });

    const expenses = [];
    for (let index = 0; index < input.lines.length; index++) {
      const line = input.lines[index];
      const expense = await tx.expense.create({
        data: {
          branchId,
          documentId: document.id,
          invoiceNumber,
          lineNumber: index + 1,
          category: line.category,
          description: line.description.trim(),
          amount: roundAmount(Number(line.amount)),
          expenseDate,
          paymentMethod,
          notes: input.notes?.trim() || null,
          purchaseReturnId: input.purchaseReturnId || null,
        },
      });
      expenses.push(expense);
    }

    return { document, expenses, invoiceNumber };
  });
}

export async function deleteExpenseLine(
  db: Db,
  branchId: string,
  expenseId: string
): Promise<{ deletedDocument: boolean }> {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, branchId },
    select: { id: true, documentId: true, purchaseReturnId: true },
  });
  if (!expense) throw new Error("NOT_FOUND");
  if (expense.purchaseReturnId) throw new Error("LOCKED");

  const documentId = expense.documentId;

  await db.expense.delete({ where: { id: expense.id } });

  if (!documentId) {
    return { deletedDocument: false };
  }

  const remaining = await db.expense.count({
    where: { documentId },
  });

  if (remaining === 0) {
    await db.expenseDocument.delete({ where: { id: documentId } });
    return { deletedDocument: true };
  }

  await renumberDocumentLines(db, documentId);
  return { deletedDocument: false };
}

async function renumberDocumentLines(db: Db, documentId: string): Promise<void> {
  const lines = await db.expense.findMany({
    where: { documentId },
    orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
    select: { id: true, lineNumber: true },
  });

  for (let index = 0; index < lines.length; index++) {
    const nextNumber = index + 1;
    if (lines[index].lineNumber !== nextNumber) {
      await db.expense.update({
        where: { id: lines[index].id },
        data: { lineNumber: nextNumber },
      });
    }
  }
}

export async function updateExpenseLine(
  db: Db,
  branchId: string,
  expenseId: string,
  input: { category?: string; description?: string; amount?: number }
) {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, branchId },
    select: { id: true, purchaseReturnId: true },
  });
  if (!expense) throw new Error("NOT_FOUND");
  if (expense.purchaseReturnId) throw new Error("LOCKED");

  const data: {
    category?: string;
    description?: string;
    amount?: number;
  } = {};

  if (input.category !== undefined) {
    if (!input.category.trim()) throw new Error("INVALID_LINE");
    data.category = input.category;
  }

  if (input.description !== undefined) {
    if (!input.description.trim()) throw new Error("INVALID_LINE");
    data.description = input.description.trim();
  }

  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("INVALID_AMOUNT");
    data.amount = roundAmount(Number(input.amount));
  }

  if (Object.keys(data).length === 0) throw new Error("NO_CHANGES");

  return db.expense.update({
    where: { id: expenseId },
    data,
  });
}

export async function updateExpenseDocument(
  db: Db,
  branchId: string,
  documentId: string,
  input: { paymentMethod?: string; notes?: string | null }
) {
  const document = await db.expenseDocument.findFirst({
    where: { id: documentId, branchId },
    select: { id: true },
  });
  if (!document) throw new Error("NOT_FOUND");

  const docData: { paymentMethod?: string; notes?: string | null } = {};
  const lineData: { paymentMethod?: string; notes?: string | null } = {};

  if (input.paymentMethod !== undefined) {
    docData.paymentMethod = input.paymentMethod || "cash";
    lineData.paymentMethod = docData.paymentMethod;
  }

  if (input.notes !== undefined) {
    docData.notes = input.notes?.trim() || null;
    lineData.notes = docData.notes;
  }

  if (Object.keys(docData).length === 0) throw new Error("NO_CHANGES");

  return db.$transaction(async (tx) => {
    const updated = await tx.expenseDocument.update({
      where: { id: documentId },
      data: docData,
    });

    if (Object.keys(lineData).length > 0) {
      await tx.expense.updateMany({
        where: { documentId },
        data: lineData,
      });
    }

    return updated;
  });
}

export async function getExpenseDocumentById(db: Db, branchId: string, documentId: string) {
  const document = await db.expenseDocument.findFirst({
    where: { id: documentId, branchId },
    include: {
      expenses: {
        orderBy: [{ lineNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!document) throw new Error("NOT_FOUND");

  const lines = document.expenses;
  const total = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;

  return {
    id: document.id,
    invoiceNumber: document.invoiceNumber,
    paymentMethod: document.paymentMethod,
    expenseDate: document.expenseDate.toISOString(),
    notes: document.notes,
    total,
    lineCount: lines.length,
    lines: lines.map((line) => ({
      id: line.id,
      category: line.category,
      description: line.description,
      amount: line.amount,
      expenseDate: line.expenseDate.toISOString(),
      paymentMethod: line.paymentMethod,
      lineNumber: line.lineNumber,
      purchaseReturnId: line.purchaseReturnId,
    })),
  };
}

export async function deleteExpenseDocument(
  db: Db,
  branchId: string,
  documentId: string
): Promise<number> {
  const document = await db.expenseDocument.findFirst({
    where: { id: documentId, branchId },
    include: { expenses: { select: { id: true } } },
  });
  if (!document) throw new Error("NOT_FOUND");

  await db.expense.deleteMany({ where: { documentId: document.id } });
  await db.expenseDocument.delete({ where: { id: document.id } });
  return document.expenses.length;
}
