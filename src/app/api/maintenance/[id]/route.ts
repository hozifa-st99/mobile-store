import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const body = await request.json();

  const existing = await prisma.maintenanceOrder.findFirst({
    where: { id: params.id, branchId: auth.branchId },
  });
  if (!existing) {
    return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
  }

  const order = await prisma.maintenanceOrder.update({
    where: { id: params.id },
    data: {
      status: body.status ?? existing.status,
      cost: body.cost ?? existing.cost,
      paidAmount: body.paidAmount ?? existing.paidAmount,
      notes: body.notes ?? existing.notes,
      deliveredDate:
        body.status === "delivered" ? new Date() : existing.deliveredDate,
    },
    include: { customer: true },
  });

  return NextResponse.json({ order });
}
