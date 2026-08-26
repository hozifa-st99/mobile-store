import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveReportRange } from "@/lib/report-dates";

type RouteContext = { params: Promise<{ employeeId: string }> };

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { employeeId } = await context.params;

  const employee = await prisma.branchEmployee.findFirst({
    where: { id: employeeId, branchId: auth.branchId, isActive: true },
    select: { id: true, nameAr: true, employeeCode: true },
  });
  if (!employee) {
    return NextResponse.json({ message: "الموظف غير موجود" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const range = resolveReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });
  const from = new Date(range.from);
  const to = new Date(range.to);

  const sales = await prisma.sale.findMany({
    where: {
      branchId: auth.branchId,
      branchEmployeeId: employee.id,
      status: "completed",
      saleDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      invoiceNumber: true,
      saleDate: true,
      total: true,
      paymentMethod: true,
      customer: { select: { nameAr: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
  });

  const rows = sales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate.toISOString(),
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    paymentLabel: paymentLabels[sale.paymentMethod] || sale.paymentMethod,
    customerName: sale.customer?.nameAr || "—",
    itemCount: sale._count.items,
  }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.count += 1;
      acc.total += row.total;
      acc.items += row.itemCount;
      return acc;
    },
    { count: 0, total: 0, items: 0 }
  );

  return NextResponse.json({
    employee,
    periodLabel: range.label,
    rows,
    totals,
  });
}
