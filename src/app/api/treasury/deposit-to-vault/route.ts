import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { depositOpenShiftToVault } from "@/lib/treasury-shift";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: { amount?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  try {
    const result = await depositOpenShiftToVault(
      auth.branchId,
      auth.userId,
      amount,
      notes || null
    );

    return NextResponse.json({
      message: `تم توريد ${result.amount} ج.م إلى خزنة الفرع (${result.documentNumber})`,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_VAULT_AMOUNT") {
        return NextResponse.json({ message: "أدخل مبلغاً صحيحاً أكبر من صفر" }, { status: 400 });
      }
      if (error.message === "EXCEEDS_AVAILABLE_CASH") {
        return NextResponse.json(
          { message: "المبلغ أكبر من النقدي المتاح للتوريد في الوردية المفتوحة" },
          { status: 400 }
        );
      }
      if (error.message === "NO_AVAILABLE_CASH") {
        return NextResponse.json(
          { message: "لا يوجد نقدي متاح للتوريد من الوردية المفتوحة" },
          { status: 400 }
        );
      }
    }
    console.error("deposit open shift to vault error:", error);
    return NextResponse.json({ message: "تعذر توريد النقدية للخزنة" }, { status: 500 });
  }
}
