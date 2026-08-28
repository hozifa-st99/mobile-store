import type { Prisma } from "@prisma/client";

import { compareNewestDocumentFirst } from "@/lib/document-list-sort";
import { prisma } from "@/lib/prisma";
import {
  computePurchaseReturnExpenseRecoveryCash,
  computePurchaseReturnCashFromReturn,
} from "@/lib/purchase-return-settlement";

type Db = Prisma.TransactionClient | typeof prisma;

export type TreasuryTransactionType =
  | "sale"
  | "sale_return"
  | "purchase"
  | "purchase_debt_payment"
  | "purchase_return"
  | "purchase_receivable_collection"
  | "purchase_return_expense_recovery"
  | "expense"
  | "open_shift_deposit";

export interface TreasuryTransaction {
  id: string;
  type: TreasuryTransactionType;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  signedAmount: number;
  date: string;
  createdAt: string;
  documentNumber: string;
  description: string;
  detailUrl: string;
  paymentMethod?: string | null;
}

export interface TreasurySummary {
  currentBalance: number;
  totalIn: number;
  totalOut: number;
  netInPeriod: number;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: "إيجار",
  utilities: "مرافق",
  salary: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
  "مصاريف مشتريات": "مصاريف مشتريات",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
  transfer: "تحويل",
};

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

function signed(direction: "in" | "out", amount: number): number {
  return direction === "in" ? amount : -amount;
}

export function summarizeTreasuryTransactions(
  rows: TreasuryTransaction[]
): Pick<TreasurySummary, "totalIn" | "totalOut" | "netInPeriod"> {
  const totalIn = rows.reduce((s, r) => s + (r.direction === "in" ? r.amount : 0), 0);
  const totalOut = rows.reduce((s, r) => s + (r.direction === "out" ? r.amount : 0), 0);
  return {
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    netInPeriod: Math.round((totalIn - totalOut) * 100) / 100,
  };
}

/** يبني كل حركات الخزنة بدون حد — للوردية والسجل الكامل */
export async function buildAllTreasuryTransactions(branchId: string): Promise<TreasuryTransaction[]> {
  const [
    sales,
    purchases,
    purchaseDebtPayments,
    expenses,
    purchaseReturns,
    receivableCollections,
    saleReturns,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { branchId, status: "completed" },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        saleDate: true,
        createdAt: true,
        paymentMethod: true,
        customer: { select: { nameAr: true } },
      },
    }),
    prisma.purchase.findMany({
      where: {
        branchId,
        status: "completed",
        invoiceCashPaid: { gt: 0 },
        cashSource: "shift",
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceCashPaid: true,
        purchaseDate: true,
        createdAt: true,
        supplier: { select: { nameAr: true } },
      },
    }),
    prisma.creditLedgerPayment.findMany({
      where: {
        movementType: "payment",
        cashSource: "shift",
        branchId,
        entry: { purchaseId: { not: null } },
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        createdAt: true,
        entry: {
          select: {
            purchase: {
              select: { id: true, invoiceNumber: true, supplier: { select: { nameAr: true } } },
            },
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { branchId },
      select: {
        id: true,
        category: true,
        description: true,
        amount: true,
        expenseDate: true,
        createdAt: true,
        paymentMethod: true,
        invoiceNumber: true,
        lineNumber: true,
        purchaseReturn: { select: { returnNumber: true, purchaseId: true } },
      },
    }),
    prisma.purchaseReturn.findMany({
      where: { branchId },
      select: {
        id: true,
        returnNumber: true,
        subtotal: true,
        total: true,
        shiftDepositAmount: true,
        expenseRecoveredAmount: true,
        creditReductionAmount: true,
        returnDate: true,
        createdAt: true,
        purchase: { select: { id: true, invoiceNumber: true } },
      },
    }),
    prisma.purchaseReceivableCollection.findMany({
      where: { branchId },
      select: {
        id: true,
        amount: true,
        collectedAt: true,
        createdAt: true,
        receivable: {
          select: {
            purchaseReturn: { select: { returnNumber: true } },
            purchase: { select: { id: true, invoiceNumber: true } },
            supplier: { select: { nameAr: true } },
          },
        },
      },
    }),
    prisma.saleReturn.findMany({
      where: { branchId },
      select: {
        id: true,
        returnNumber: true,
        total: true,
        returnDate: true,
        createdAt: true,
        sale: { select: { id: true, invoiceNumber: true } },
      },
    }),
  ]);

  const rows: TreasuryTransaction[] = [];

  for (const s of sales) {
    rows.push({
      id: s.id,
      type: "sale",
      typeLabel: "فاتورة مبيعات",
      direction: "in",
      amount: s.total,
      signedAmount: signed("in", s.total),
      date: s.saleDate.toISOString(),
      createdAt: s.createdAt.toISOString(),
      documentNumber: s.invoiceNumber,
      description: s.customer?.nameAr || "عميل نقدي",
      detailUrl: `/dashboard/sales/${s.id}`,
      paymentMethod: PAYMENT_LABELS[s.paymentMethod] || s.paymentMethod,
    });
  }

  for (const p of purchases) {
    rows.push({
      id: p.id,
      type: "purchase",
      typeLabel: "فاتورة مشتريات",
      direction: "out",
      amount: p.invoiceCashPaid,
      signedAmount: signed("out", p.invoiceCashPaid),
      date: p.purchaseDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
      documentNumber: p.invoiceNumber,
      description: p.supplier.nameAr,
      detailUrl: `/dashboard/purchases/${p.id}`,
      paymentMethod: "نقدي — وردية",
    });
  }

  for (const pay of purchaseDebtPayments) {
    const purchase = pay.entry.purchase;
    if (!purchase) continue;
    rows.push({
      id: `debt-pay-${pay.id}`,
      type: "purchase_debt_payment",
      typeLabel: "سداد أجل مشتريات",
      direction: "out",
      amount: pay.amount,
      signedAmount: signed("out", pay.amount),
      date: pay.paidAt.toISOString(),
      createdAt: pay.createdAt.toISOString(),
      documentNumber: purchase.invoiceNumber,
      description: `${purchase.supplier.nameAr} — سداد`,
      detailUrl: `/dashboard/purchases/${purchase.id}`,
      paymentMethod: "نقدي — وردية",
    });
  }

  for (const e of expenses) {
    const categoryLabel = EXPENSE_CATEGORY_LABELS[e.category] || e.category;
    const linkedReturn = e.purchaseReturn?.returnNumber;
    rows.push({
      id: e.id,
      type: "expense",
      typeLabel: linkedReturn ? "مصروف (مرتجع مشتريات)" : "مصروف",
      direction: "out",
      amount: e.amount,
      signedAmount: signed("out", e.amount),
      date: e.expenseDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      documentNumber: e.invoiceNumber || linkedReturn || "—",
      description: linkedReturn
        ? `${categoryLabel} · ${e.description}`
        : e.lineNumber > 1
          ? `${categoryLabel} · ${e.description} · بند ${e.lineNumber}`
          : `${categoryLabel} · ${e.description}`,
      detailUrl: e.purchaseReturn?.purchaseId
        ? `/dashboard/purchases/${e.purchaseReturn.purchaseId}`
        : "/dashboard/expenses",
      paymentMethod: PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod,
    });
  }

  for (const r of purchaseReturns) {
    const cashFromReturn = computePurchaseReturnCashFromReturn(
      r.total,
      r.creditReductionAmount
    );
    const expenseRecoveryCash = computePurchaseReturnExpenseRecoveryCash(
      r.expenseRecoveredAmount,
      cashFromReturn
    );

    if (r.shiftDepositAmount > 0.0001) {
      rows.push({
        id: `${r.id}-shift-deposit`,
        type: "purchase_return",
        typeLabel: "توريد مرتجع مشتريات",
        direction: "in",
        amount: r.shiftDepositAmount,
        signedAmount: signed("in", r.shiftDepositAmount),
        date: r.returnDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        documentNumber: r.returnNumber,
        description: `توريد مرتجع · فاتورة ${r.purchase.invoiceNumber}`,
        detailUrl: `/dashboard/purchases/${r.purchase.id}`,
      });
    }

    if (expenseRecoveryCash > 0.0001) {
      rows.push({
        id: `${r.id}-expense-recovery`,
        type: "purchase_return_expense_recovery",
        typeLabel: "استرداد مصاريف مشتريات",
        direction: "in",
        amount: expenseRecoveryCash,
        signedAmount: signed("in", expenseRecoveryCash),
        date: r.returnDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        documentNumber: r.returnNumber,
        description: `توريد مصاريف فاتورة من المورد · ${formatAmount(expenseRecoveryCash)} ج.م`,
        detailUrl: `/dashboard/purchases/${r.purchase.id}`,
      });
    }
  }

  for (const collection of receivableCollections) {
    const receivable = collection.receivable;
    rows.push({
      id: collection.id,
      type: "purchase_receivable_collection",
      typeLabel: "تحصيل مستحق مورد",
      direction: "in",
      amount: collection.amount,
      signedAmount: signed("in", collection.amount),
      date: collection.collectedAt.toISOString(),
      createdAt: collection.createdAt.toISOString(),
      documentNumber: receivable.purchaseReturn.returnNumber,
      description: `تحصيل من ${receivable.supplier.nameAr} · فاتورة ${receivable.purchase.invoiceNumber}`,
      detailUrl: `/dashboard/purchases/${receivable.purchase.id}`,
    });
  }

  for (const r of saleReturns) {
    rows.push({
      id: r.id,
      type: "sale_return",
      typeLabel: "مرتجع مبيعات",
      direction: "out",
      amount: r.total,
      signedAmount: signed("out", r.total),
      date: r.returnDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      documentNumber: r.returnNumber,
      description: `مرتجع على فاتورة ${r.sale.invoiceNumber}`,
      detailUrl: `/dashboard/sales/${r.sale.id}`,
    });
  }

  rows.sort((a, b) => compareNewestDocumentFirst(a.date, a.createdAt, b.date, b.createdAt));
  return rows;
}

/** رصيد الخزنة = وارد − صادر (مطابق لبنود الشاشة) */
export async function computeTreasuryBalance(db: Db, branchId: string): Promise<number> {
  const [
    sales,
    purchases,
    purchaseDebtPayments,
    expenses,
    purchaseReturns,
    purchaseReturnDeposits,
    receivableCollections,
    saleReturns,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { branchId, status: "completed" },
      _sum: { total: true },
    }),
    db.purchase.aggregate({
      where: {
        branchId,
        status: "completed",
        invoiceCashPaid: { gt: 0 },
        cashSource: "shift",
      },
      _sum: { invoiceCashPaid: true },
    }),
    db.creditLedgerPayment.aggregate({
      where: {
        movementType: "payment",
        cashSource: "shift",
        branchId,
        entry: { purchaseId: { not: null } },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { branchId },
      _sum: { amount: true },
    }),
    db.purchaseReturn.findMany({
      where: { branchId },
      select: {
        total: true,
        creditReductionAmount: true,
        expenseRecoveredAmount: true,
      },
    }),
    db.purchaseReturn.aggregate({
      where: { branchId },
      _sum: { shiftDepositAmount: true },
    }),
    db.purchaseReceivableCollection.aggregate({
      where: { branchId },
      _sum: { amount: true },
    }),
    db.saleReturn.aggregate({
      where: { branchId },
      _sum: { total: true },
    }),
  ]);

  let purchaseReturnExpenseRecovery = 0;
  for (const r of purchaseReturns) {
    const cashFromReturn = computePurchaseReturnCashFromReturn(
      r.total,
      r.creditReductionAmount
    );
    purchaseReturnExpenseRecovery += computePurchaseReturnExpenseRecoveryCash(
      r.expenseRecoveredAmount,
      cashFromReturn
    );
  }

  const balance =
    (sales._sum.total || 0) -
    (purchases._sum.invoiceCashPaid || 0) -
    (purchaseDebtPayments._sum.amount || 0) +
    (purchaseReturnDeposits._sum.shiftDepositAmount || 0) +
    purchaseReturnExpenseRecovery +
    (receivableCollections._sum.amount || 0) -
    (expenses._sum.amount || 0) -
    (saleReturns._sum.total || 0);

  return Math.round(balance * 100) / 100;
}

export async function buildTreasuryLedger(
  branchId: string,
  options?: { dateFrom?: string; dateTo?: string; limit?: number }
): Promise<{ transactions: TreasuryTransaction[]; summary: TreasurySummary }> {
  const dateRange = buildDateRange(options?.dateFrom, options?.dateTo);
  const limit = Math.min(500, Math.max(1, options?.limit ?? 300));

  const [allRows, currentBalance] = await Promise.all([
    buildAllTreasuryTransactions(branchId),
    computeTreasuryBalance(prisma, branchId),
  ]);

  const filtered = dateRange
    ? allRows.filter((row) => {
        const d = new Date(row.date);
        if (dateRange.gte && d < dateRange.gte) return false;
        if (dateRange.lte && d > dateRange.lte) return false;
        return true;
      })
    : allRows;

  const limited = filtered.slice(0, limit);
  const totals = summarizeTreasuryTransactions(limited);

  return {
    transactions: limited,
    summary: {
      currentBalance,
      ...totals,
    },
  };
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
