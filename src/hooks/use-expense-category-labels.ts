"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_EXPENSE_CATEGORIES,
  categoriesToLabelMap,
  type ExpenseCategoryItem,
} from "@/lib/expense-categories";

const fallbackLabels = categoriesToLabelMap(DEFAULT_EXPENSE_CATEGORIES);

export function useExpenseCategoryLabels(): {
  labels: Record<string, string>;
  categories: ExpenseCategoryItem[];
  loading: boolean;
} {
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/expense-categories", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories)) setCategories(d.categories);
      })
      .catch(() => {
        /* defaults */
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    labels: categoriesToLabelMap(categories),
    categories,
    loading,
  };
}

export { fallbackLabels as defaultExpenseCategoryLabels };