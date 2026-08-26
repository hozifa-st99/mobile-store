import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScreenAccess } from "@/lib/api-auth";
import { inclusivePeriodDays } from "@/lib/report-dates";
import {
  buildProductCrossBranchComparison,
  branchHasMeaningfulActivity,
  computeBranchComparisonRow,
  computePerformanceScores,
  resolveBranchComparisonReportRange,
  resolveComparisonRange,
} from "@/lib/branch-comparison-metrics";

export async function GET(request: NextRequest) {
  const { auth, error } = await requireScreenAccess(request, "reports");
  if (error || !auth) return error;

  const { searchParams } = new URL(request.url);
  const range = resolveBranchComparisonReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });

  const from = new Date(range.from);
  const to = new Date(range.to);
  const compareMode = searchParams.get("compare") || "none";
  const compareRange = resolveComparisonRange(
    compareMode,
    from,
    to,
    searchParams.get("compareFrom"),
    searchParams.get("compareTo")
  );

  const branchIdsParam = searchParams.get("branchIds");
  const productSearch = searchParams.get("productSearch") || undefined;

  const allBranches = await prisma.branch.findMany({
    where: { companyId: auth.companyId, isActive: true },
    select: { id: true, nameAr: true, code: true },
    orderBy: { nameAr: "asc" },
  });

  const parsedBranchIds = branchIdsParam ? branchIdsParam.split(",").filter(Boolean) : [];
  const selectedIds =
    parsedBranchIds.length > 0 ? parsedBranchIds : allBranches.map((b) => b.id);

  const branches = allBranches.filter((b) => selectedIds.includes(b.id));
  const periodDays = inclusivePeriodDays(from, to);

  const rows = await Promise.all(
    branches.map((b) =>
      computeBranchComparisonRow(prisma, b.id, b.nameAr, b.code, auth.companyId, from, to)
    )
  );

  let compareRows: Awaited<ReturnType<typeof computeBranchComparisonRow>>[] | null = null;
  if (compareRange) {
    compareRows = await Promise.all(
      branches.map((b) =>
        computeBranchComparisonRow(
          prisma,
          b.id,
          b.nameAr,
          b.code,
          auth.companyId,
          compareRange.from,
          compareRange.to
        )
      )
    );
  }

  const scores = computePerformanceScores(rows);
  const bestBranchId = Array.from(scores.entries())
    .filter(([id, score]) => {
      const row = rows.find((r) => r.branchId === id);
      return row && !score.insufficientData && branchHasMeaningfulActivity(row);
    })
    .sort((a, b) => b[1].overall - a[1].overall)[0]?.[0] ?? null;

  const performanceScores = Object.fromEntries(scores);
  const productComparison = await buildProductCrossBranchComparison(rows, productSearch);

  const compareByBranchId = compareRows
    ? Object.fromEntries(compareRows.map((r) => [r.branchId, r]))
    : null;

  return NextResponse.json(
    {
      range: { ...range, periodDays },
      compareRange: compareRange
        ? {
            from: compareRange.from.toISOString(),
            to: compareRange.to.toISOString(),
            mode: compareMode,
          }
        : null,
      branches: allBranches.map((b) => ({ id: b.id, name: b.nameAr, code: b.code })),
      rows,
      compareByBranchId,
      performanceScores,
      bestBranchId,
      productComparison,
    },
    { headers: { "Cache-Control": "private, max-age=15" } }
  );
}
