"use client";

import { em } from "@/components/ui/TableEmoji";

export type CatalogTypeFilter = "" | "phone" | "accessory";

interface ReportCatalogTypeFilterProps {
  value: CatalogTypeFilter;
  onChange: (value: CatalogTypeFilter) => void;
}

const options: { id: CatalogTypeFilter; label: string; emoji: string }[] = [
  { id: "", label: "الكل", emoji: em.product },
  { id: "phone", label: "موبايل", emoji: em.device },
  { id: "accessory", label: "إكسسوار", emoji: em.category },
];

export default function ReportCatalogTypeFilter({ value, onChange }: ReportCatalogTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id || "all"}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            value === opt.id
              ? "bg-primary/25 text-white border border-primary/40"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          <span>{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
