import type { Prisma } from "@prisma/client";

import {
  DEFAULT_EXPENSE_CATEGORIES,
  type ExpenseCategoryItem,
  categoriesToLabelMap,
  expenseCategoriesSettingKey,
  normalizeExpenseCategories,
} from "@/lib/expense-categories";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function loadExpenseCategories(
  db: Db,
  companyId: string
): Promise<ExpenseCategoryItem[]> {
  const row = await db.appSetting.findUnique({
    where: {
      companyId_key: { companyId, key: expenseCategoriesSettingKey() },
    },
  });

  if (!row) return [...DEFAULT_EXPENSE_CATEGORIES];
  try {
    return normalizeExpenseCategories(JSON.parse(row.value));
  } catch {
    return [...DEFAULT_EXPENSE_CATEGORIES];
  }
}

export async function loadExpenseCategoryLabelMap(
  db: Db,
  companyId: string
): Promise<Record<string, string>> {
  const categories = await loadExpenseCategories(db, companyId);
  return categoriesToLabelMap(categories);
}

export async function countExpensesUsingCategory(companyId: string, categoryKey: string): Promise<number> {
  return prisma.expense.count({
    where: {
      category: categoryKey,
      branch: { companyId },
    },
  });
}

export async function saveExpenseCategories(
  companyId: string,
  categories: ExpenseCategoryItem[]
): Promise<ExpenseCategoryItem[]> {
  const normalized = normalizeExpenseCategories(categories);

  await prisma.appSetting.upsert({
    where: {
      companyId_key: { companyId, key: expenseCategoriesSettingKey() },
    },
    create: {
      companyId,
      key: expenseCategoriesSettingKey(),
      value: JSON.stringify(normalized),
    },
    update: { value: JSON.stringify(normalized) },
  });

  return normalized;
}