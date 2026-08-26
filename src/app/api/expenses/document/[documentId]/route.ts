import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { isExpenseDocumentDeposited } from "@/lib/expense-deposits";
import {
  deleteExpenseDocument,
  getExpenseDocumentById,
  updateExpenseDocument,
} from "@/lib/expense-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { documentId } = await params;

  try {
    const document = await getExpenseDocumentById(prisma, auth.branchId, documentId);
    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ message: "قائمة المصروفات غير موجودة" }, { status: 404 });
    }
    console.error("expense document get error:", error);
    return NextResponse.json({ message: "تعذر تحميل التفاصيل" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { documentId } = await params;

  if (await isExpenseDocumentDeposited(auth.branchId, documentId)) {
    return NextResponse.json({ message: "لا يمكن تعديل مصروفات تم توريدها" }, { status: 400 });
  }

  const body = await request.json();
  const { paymentMethod, notes } = body;

  try {
    const document = await updateExpenseDocument(prisma, auth.branchId, documentId, {
      ...(paymentMethod !== undefined ? { paymentMethod } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ message: "قائمة المصروفات غير موجودة" }, { status: 404 });
    }
    if (message === "NO_CHANGES") {
      return NextResponse.json({ message: "لا توجد تغييرات" }, { status: 400 });
    }
    console.error("expense document patch error:", error);
    return NextResponse.json({ message: "تعذر حفظ التعديلات" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { documentId } = await params;

  if (await isExpenseDocumentDeposited(auth.branchId, documentId)) {
    return NextResponse.json({ message: "لا يمكن حذف قائمة مصروفات تم توريدها" }, { status: 400 });
  }

  try {
    const deletedCount = await deleteExpenseDocument(prisma, auth.branchId, documentId);
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ message: "قائمة المصروفات غير موجودة" }, { status: 404 });
    }
    console.error("expense document delete error:", error);
    return NextResponse.json({ message: "تعذر حذف قائمة المصروفات" }, { status: 500 });
  }
}
