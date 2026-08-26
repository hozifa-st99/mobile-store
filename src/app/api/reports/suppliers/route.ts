import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveReportRange } from "@/lib/report-dates";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const range = resolveReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });
  const from = new Date(range.from);
  const to = new Date(range.to);
  const search = searchParams.get("search")?.trim() || "";
  const sort = searchParams.get("sort") === "total" ? "total" : "name";

  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
      ...(search
        ? {
            OR: [{ nameAr: { contains: search } }, { phone: { contains: search } }],
          }
        : {}),
    },
    select: {
      id: true,
      nameAr: true,
      phone: true,
      purchases: {
        where: {
          branchId: auth.branchId,
          status: "completed",
          purchaseDate: { gte: from, lte: to },
        },
        select: { id: true, total: true },
      },
    },
  });

  const rows = suppliers
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.nameAr,
      phone: supplier.phone,
      invoiceCount: supplier.purchases.length,
      totalPurchases: Math.round(supplier.purchases.reduce((sum, p) => sum + p.total, 0) * 100) / 100,
    }))
    .filter((row) => row.invoiceCount > 0 || !search);

  rows.sort((a, b) =>
    sort === "total" ? b.totalPurchases - a.totalPurchases : a.name.localeCompare(b.name, "ar")
  );

  return NextResponse.json({ range, suppliers: rows });
}
