import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
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

  const employees = await prisma.branchEmployee.findMany({
    where: { branchId: auth.branchId, isActive: true },
    orderBy: { employeeCode: "asc" },
  });

  const sales = await prisma.sale.findMany({
    where: {
      branchId: auth.branchId,
      status: "completed",
      branchEmployeeId: { not: null },
      saleDate: { gte: from, lte: to },
    },
    select: {
      branchEmployeeId: true,
      total: true,
      items: {
        select: {
          quantity: true,
          total: true,
          product: { select: { type: true } },
        },
      },
    },
  });

  const byEmployee = new Map<
    string,
    { salesCount: number; salesTotal: number; phoneCount: number; accessoryCount: number }
  >();
  for (const sale of sales) {
    if (!sale.branchEmployeeId) continue;
    const prev = byEmployee.get(sale.branchEmployeeId) ?? {
      salesCount: 0,
      salesTotal: 0,
      phoneCount: 0,
      accessoryCount: 0,
    };
    prev.salesCount += 1;
    prev.salesTotal += sale.total;
    for (const item of sale.items) {
      if (item.product?.type === "phone") prev.phoneCount += item.quantity;
      else prev.accessoryCount += item.quantity;
    }
    byEmployee.set(sale.branchEmployeeId, prev);
  }

  const rows = employees.map((emp) => {
    const stats = byEmployee.get(emp.id) ?? {
      salesCount: 0,
      salesTotal: 0,
      phoneCount: 0,
      accessoryCount: 0,
    };
    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      nameAr: emp.nameAr,
      phone: emp.phone,
      address: emp.address,
      salesCount: stats.salesCount,
      salesTotal: stats.salesTotal,
      phoneCount: stats.phoneCount,
      accessoryCount: stats.accessoryCount,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.salesCount += row.salesCount;
      acc.salesTotal += row.salesTotal;
      acc.phoneCount += row.phoneCount;
      acc.accessoryCount += row.accessoryCount;
      return acc;
    },
    { salesCount: 0, salesTotal: 0, phoneCount: 0, accessoryCount: 0 }
  );

  return NextResponse.json({
    periodLabel: range.label,
    rows,
    totals,
  });
}
