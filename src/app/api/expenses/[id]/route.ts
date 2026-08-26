import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { isExpenseDeposited } from "@/lib/expense-deposits";
import { deleteExpenseLine, updateExpenseLine } from "@/lib/expense-service";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  if (await isExpenseDeposited(auth.branchId, id)) {
    return NextResponse.json({ message: "لا يمكن تعديل مصروف تم توريده" }, { status: 400 });
  }

  const body = await request.json();
  const { category, description, amount } = body;

  try {
    const expense = await updateExpenseLine(prisma, auth.branchId, id, {
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
    });
    return NextResponse.json({ expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ message: "المصروف غير موجود" }, { status: 404 });
    }
    if (message === "LOCKED") {
      return NextResponse.json({ message: "لا يمكن تعديل مصروف مرتبط بمرتجع" }, { status: 400 });
    }
    if (message === "INVALID_LINE" || message === "INVALID_AMOUNT" || message === "NO_CHANGES") {
      return NextResponse.json({ message: "البيانات غير صالحة" }, { status: 400 });
    }
    console.error("expense patch error:", error);
    return NextResponse.json({ message: "تعذر حفظ التعديل" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  if (await isExpenseDeposited(auth.branchId, id)) {
    return NextResponse.json({ message: "لا يمكن حذف مصروف تم توريده" }, { status: 400 });
  }

  try {
    await deleteExpenseLine(prisma, auth.branchId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ message: "المصروف غير موجود" }, { status: 404 });
    }
    if (message === "LOCKED") {
      return NextResponse.json({ message: "لا يمكن حذف مصروف مرتبط بمرتجع" }, { status: 400 });
    }
    console.error("expense delete error:", error);
    return NextResponse.json({ message: "تعذر حذف المصروف" }, { status: 500 });
  }
}
