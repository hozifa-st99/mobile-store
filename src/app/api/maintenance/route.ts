import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const orders = await prisma.maintenanceOrder.findMany({
    where: { branchId: auth.branchId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const body = await request.json();
  const {
    customerId,
    deviceBrand,
    deviceModel,
    imei,
    issue,
    cost = 0,
    paidAmount = 0,
    dueDate,
    notes,
  } = body;

  if (!deviceBrand?.trim() || !issue?.trim()) {
    return NextResponse.json({ message: "ماركة الجهاز والعطل مطلوبان" }, { status: 400 });
  }

  const orderNumber = `MNT-${Date.now().toString().slice(-8)}`;

  const order = await prisma.maintenanceOrder.create({
    data: {
      branchId: auth.branchId,
      customerId: customerId || null,
      orderNumber,
      deviceBrand: deviceBrand.trim(),
      deviceModel: deviceModel?.trim() || null,
      imei: imei || null,
      issue: issue.trim(),
      cost,
      paidAmount,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    },
    include: { customer: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
