export const PURCHASE_RETURN_EXPENSE_CATEGORY_KEY = "مصاريف مشتريات";

export interface ExpenseCategoryItem {
  /** يُحفظ في حقل expense.category */
  key: string;
  nameAr: string;
  sortOrder: number;
  /** تصنيف نظام — لا يُحذف */
  isSystem?: boolean;
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { key: "rent", nameAr: "إيجار", sortOrder: 1 },
  { key: "utilities", nameAr: "مرافق", sortOrder: 2 },
  { key: "salary", nameAr: "رواتب", sortOrder: 3 },
  { key: "marketing", nameAr: "تسويق", sortOrder: 4 },
  { key: "other", nameAr: "أخرى", sortOrder: 5 },
  {
    key: PURCHASE_RETURN_EXPENSE_CATEGORY_KEY,
    nameAr: "مصاريف مشتريات",
    sortOrder: 100,
    isSystem: true,
  },
];

const SETTING_KEY = "expense_categories";

export function expenseCategoriesSettingKey() {
  return SETTING_KEY;
}

export function categoriesToLabelMap(categories: ExpenseCategoryItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of categories) {
    map[c.key] = c.nameAr;
  }
  return map;
}

export function normalizeExpenseCategories(input: unknown): ExpenseCategoryItem[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...DEFAULT_EXPENSE_CATEGORIES];
  }

  const systemByKey = new Map(
    DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.isSystem).map((c) => [c.key, c] as const)
  );

  const seen = new Set<string>();
  const result: ExpenseCategoryItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    const nameAr = typeof row.nameAr === "string" ? row.nameAr.trim() : "";
    if (!key || !nameAr || seen.has(key)) continue;

    const system = systemByKey.get(key);
    seen.add(key);
    result.push({
      key,
      nameAr: system?.nameAr && system.isSystem ? system.nameAr : nameAr,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : result.length + 1,
      isSystem: Boolean(system?.isSystem ?? row.isSystem),
    });
  }

  for (const system of DEFAULT_EXPENSE_CATEGORIES.filter((c) => c.isSystem)) {
    if (!seen.has(system.key)) {
      result.push({ ...system });
      seen.add(system.key);
    }
  }

  result.sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  return result.length > 0 ? result : [...DEFAULT_EXPENSE_CATEGORIES];
}
