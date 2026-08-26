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

  const customers = await prisma.customer.findMany({
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
      sales: {
        where: {
          branchId: auth.branchId,
          status: "completed",
          saleDate: { gte: from, lte: to },
        },
        select: { id: true, total: true },
      },
    },
  });

  const rows = customers
    .map((customer) => ({
      id: customer.id,
      name: customer.nameAr,
      phone: customer.phone,
      invoiceCount: customer.sales.length,
      totalPurchases: Math.round(customer.sales.reduce((sum, sale) => sum + sale.total, 0) * 100) / 100,
    }))
    .filter((row) => row.invoiceCount > 0 || !search);

  rows.sort((a, b) =>
    sort === "total" ? b.totalPurchases - a.totalPurchases : a.name.localeCompare(b.name, "ar")
  );

  return NextResponse.json({ range, customers: rows });
}
