"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BranchComparisonDashboard from "@/components/branch-comparison/BranchComparisonDashboard";
import type { BranchComparisonSectionId } from "@/components/branch-comparison/BranchComparisonReportsModal";

const VALID_SECTIONS = new Set<BranchComparisonSectionId>([
  "overview",
  "comparison-table",
  "sales",
  "profits",
  "purchases",
  "inventory",
  "turnover",
  "products",
  "product-cross",
  "returns",
  "expenses",
  "stocktake",
  "phones",
  "kpi",
  "performance-score",
  "timeline",
]);

function BranchComparisonPageInner() {
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const initialSection =
    sectionParam && VALID_SECTIONS.has(sectionParam as BranchComparisonSectionId)
      ? (sectionParam as BranchComparisonSectionId)
      : null;

  return <BranchComparisonDashboard initialSection={initialSection} />;
}

export default function BranchComparisonPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-12 sm:p-16 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden />
          <p className="text-base sm:text-lg font-extrabold text-white">جاري تحميل وإنشاء التقارير…</p>
        </div>
      }
    >
      <BranchComparisonPageInner />
    </Suspense>
  );
}
