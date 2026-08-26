"use client";

import PhonePlatformBrandChips from "@/components/products/PhonePlatformBrandChips";
import {
  type CatalogViewFilterState,
  type CatalogViewTab,
} from "@/lib/product-catalog-view-filter";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";

interface ProductCatalogViewFilterProps {
  value: CatalogViewFilterState;
  onChange: Dispatch<SetStateAction<CatalogViewFilterState>>;
  className?: string;
}

export default function ProductCatalogViewFilter({
  value,
  onChange,
  className,
}: ProductCatalogViewFilterProps) {
  const handleTabChange = (tab: CatalogViewTab) => {
    onChange({ tab, platformId: "", phoneBrandId: "" });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            value.tab === "all"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          المنتجات
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("phones")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            value.tab === "phones"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          الموبايلات
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("accessory")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            value.tab === "accessory"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-white"
          }`}
        >
          اكسسوار
        </button>
      </div>

      {value.tab === "phones" ? (
        <PhonePlatformBrandChips
          platformId={value.platformId}
          phoneBrandId={value.phoneBrandId}
          onPlatformChange={(platformId) =>
            onChange((prev) => ({ ...prev, platformId, phoneBrandId: "" }))
          }
          onPhoneBrandChange={(phoneBrandId) =>
            onChange((prev) => ({ ...prev, phoneBrandId }))
          }
        />
      ) : null}
    </div>
  );
}
