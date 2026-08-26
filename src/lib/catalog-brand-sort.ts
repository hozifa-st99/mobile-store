/** مفاتيح التعرف على Apple / iPhone — عربي وإنجليزي واختصارات شائعة */
const APPLE_KEYS = [
  "apple",
  "iphone",
  "iphones",
  "ios",
  "ابل",
  "آبل",
  "أبل",
  "ايفون",
  "آيفون",
  "أيفون",
  "ايفونات",
  "iphoneapple",
];

/** مفاتيح التعرف على Samsung — عربي وإنجليزي */
const SAMSUNG_KEYS = [
  "samsung",
  "sumsung",
  "samung",
  "سامسونج",
  "galaxy",
  "galxy",
  "جالكسي",
  "galax",
];

function normalizeCatalogName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function matchesBrandKey(normalized: string, key: string): boolean {
  const normalizedKey = normalizeCatalogName(key);
  if (!normalizedKey) return false;
  return normalized === normalizedKey || normalized.includes(normalizedKey);
}

/** 0 = Apple/iPhone, 1 = Samsung, 100+ = alphabetical */
export function getCatalogBrandSortPriority(name: string): number {
  const normalized = normalizeCatalogName(name);

  if (APPLE_KEYS.some((key) => matchesBrandKey(normalized, key))) {
    return 0;
  }
  if (SAMSUNG_KEYS.some((key) => matchesBrandKey(normalized, key))) {
    return 1;
  }

  return 100;
}

function getPhoneCatalogEntryPriority(entry: {
  name: string;
  kind: "brand" | "platform";
}): number {
  const byName = getCatalogBrandSortPriority(entry.name);
  if (byName < 100) return byName;
  // iPhone catalog = platform without brands (direct models) — sortOrder 0 in defaults
  if (entry.kind === "platform") return 0;
  return 100;
}

export function sortPhoneCatalogEntries<
  T extends { name: string; kind: "brand" | "platform"; sortOrder?: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityDiff = getPhoneCatalogEntryPriority(a) - getPhoneCatalogEntryPriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;

    return a.name.localeCompare(b.name, "ar");
  });
}

export function sortCatalogEntriesByBrandPriority<T extends { name: string; sortOrder?: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const priorityDiff = getCatalogBrandSortPriority(a.name) - getCatalogBrandSortPriority(b.name);
    if (priorityDiff !== 0) return priorityDiff;

    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;

    return a.name.localeCompare(b.name, "ar");
  });
}

/** للعرض في الإعدادات أو التشخيص */
export const CATALOG_PRIORITY_BRAND_HINTS = {
  first: ["Apple", "iPhone", "آيفون", "أبل"],
  second: ["Samsung", "سامسونج", "Galaxy"],
} as const;
