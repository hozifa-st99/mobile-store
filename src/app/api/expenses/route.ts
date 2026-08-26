import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getOpenShiftExpenses } from "@/lib/expense-deposits";
import { createExpenseDocument, type ExpenseLineInput } from "@/lib/expense-service";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const openShift = await getOpenShiftExpenses(auth.branchId);
    return NextResponse.json({ openShift });
  } catch (error) {
    console.error("expenses list error:", error);
    return NextResponse.json({ message: "تعذر تحميل المصروفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const body = await request.json();
  const { category, description, amount, expenseDate, paymentMethod, notes, lines } = body;

  try {
    let payloadLines: ExpenseLineInput[];

    if (Array.isArray(lines) && lines.length > 0) {
      payloadLines = lines.map((line: ExpenseLineInput) => ({
        category: line.category,
        description: line.description,
        amount: Number(line.amount),
      }));
    } else if (category && description?.trim() && amount) {
      payloadLines = [
        {
          category,
          description: description.trim(),
          amount: Number(amount),
        },
      ];
    } else {
      return NextResponse.json({ message: "البيانات غير مكتملة" }, { status: 400 });
    }

    const result = await createExpenseDocument(prisma, auth.branchId, {
      paymentMethod: paymentMethod || "cash",
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      notes: notes || null,
      lines: payloadLines,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "INVALID_LINE" || message === "INVALID_AMOUNT" || message === "NO_LINES") {
      return NextResponse.json({ message: "البيانات غير مكتملة أو المبلغ غير صالح" }, { status: 400 });
    }
    console.error("expense create error:", error);
    return NextResponse.json({ message: "تعذر حفظ المصروف" }, { status: 500 });
  }
}
