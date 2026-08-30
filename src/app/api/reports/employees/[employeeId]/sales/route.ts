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
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          total: true,
          imei: true,
          product: { select: { type: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
  });

  const phoneLines: {
    id: string;
    description: string;
    quantity: number;
    total: number;
    imei: string | null;
    invoiceNumber: string;
    saleDate: string;
  }[] = [];
  const accessoryLines: {
    id: string;
    description: string;
    quantity: number;
    total: number;
    invoiceNumber: string;
    saleDate: string;
  }[] = [];

  const rows = sales.map((sale) => {
    let phoneCount = 0;
    let accessoryCount = 0;
    for (const item of sale.items) {
      const line = {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        total: item.total,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate.toISOString(),
      };
      if (item.product?.type === "phone") {
        phoneCount += item.quantity;
        phoneLines.push({ ...line, imei: item.imei });
      } else {
        accessoryCount += item.quantity;
        accessoryLines.push(line);
      }
    }
    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString(),
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      paymentLabel: paymentLabels[sale.paymentMethod] || sale.paymentMethod,
      customerName: sale.customer?.nameAr || "—",
      itemCount: sale.items.length,
      phoneCount,
      accessoryCount,
    };
  });

  const phoneAmount = phoneLines.reduce((sum, line) => sum + line.total, 0);
  const accessoryAmount = accessoryLines.reduce((sum, line) => sum + line.total, 0);
  const phoneCount = phoneLines.reduce((sum, line) => sum + line.quantity, 0);
  const accessoryCount = accessoryLines.reduce((sum, line) => sum + line.quantity, 0);

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
    totals: {
      ...totals,
      phones: { quantity: phoneCount, amount: phoneAmount },
      accessories: { quantity: accessoryCount, amount: accessoryAmount },
    },
    phoneLines,
    accessoryLines,
  });
}
