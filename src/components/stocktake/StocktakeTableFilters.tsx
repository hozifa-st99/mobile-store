"use client";

import type { StocktakeProductFilter } from "@/lib/stocktake-line-types";

interface FilterOption {
  id: string;
  name: string;
}

interface StocktakeTableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: StocktakeProductFilter;
  onTypeFilterChange: (value: StocktakeProductFilter) => void;
  subFilter: string;
  onSubFilterChange: (value: string) => void;
  phoneBrandOptions: FilterOption[];
  categoryOptions: FilterOption[];
  onClear: () => void;
  showClear: boolean;
  showSearch?: boolean;
  showTypeFilters?: boolean;
  searchPlaceholder?: string;
}

export default function StocktakeTableFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  subFilter,
  onSubFilterChange,
  phoneBrandOptions,
  categoryOptions,
  onClear,
  showClear,
  showSearch = true,
  showTypeFilters = true,
  searchPlaceholder = "بحث بالاسم أو الباركود أو IMEI...",
}: StocktakeTableFiltersProps) {
  const subOptions = typeFilter === "phone" ? phoneBrandOptions : categoryOptions;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-col lg:flex-row gap-3">
        {showSearch ? (
          <div className="relative flex-1">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg opacity-60">🔍</span>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm text-white"
            />
          </div>
        ) : null}

        {showTypeFilters ? (
          <>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value as StocktakeProductFilter)}
              className="bg-background-input border border-border rounded-xl py-2.5 px-4 text-sm text-white lg:min-w-[160px]"
            >
              <option value="all">الكل</option>
              <option value="phone">موبايلات</option>
              <option value="accessory">إكسسوارات</option>
            </select>

            {typeFilter !== "all" ? (
              <select
                value={subFilter}
                onChange={(e) => onSubFilterChange(e.target.value)}
                className="bg-background-input border border-border rounded-xl py-2.5 px-4 text-sm text-white lg:min-w-[200px]"
              >
                <option value="">
                  {typeFilter === "phone" ? "كل شركات الموبايل" : "كل أنواع الإكسسوارات"}
                </option>
                {subOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}

        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white hover:border-primary/30 whitespace-nowrap"
          >
            مسح الفلاتر
          </button>
        ) : null}
      </div>

      {showTypeFilters && typeFilter !== "all" && subOptions.length === 0 ? (
        <p className="text-xs text-muted">لا توجد خيارات متاحة لهذا النوع في الجرد الحالي</p>
      ) : null}
    </div>
  );
}
