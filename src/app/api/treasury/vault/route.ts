import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import {
  listBranchVaultMovements,
  parseBranchVaultMovementType,
  recordManualBranchVaultCash,
} from "@/lib/branch-vault";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const invoiceNumber = searchParams.get("invoiceNumber")?.trim() || undefined;
  const typeRaw = searchParams.get("type")?.trim();
  const type = typeRaw ? parseBranchVaultMovementType(typeRaw) ?? undefined : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const data = await listBranchVaultMovements(auth.branchId, {
    dateFrom,
    dateTo,
    invoiceNumber,
    type,
    limit,
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  let body: { action?: unknown; amount?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة" }, { status: 400 });
  }

  const action = body.action === "deposit" || body.action === "withdraw" ? body.action : null;
  if (!action) {
    return NextResponse.json({ message: "اختر إيداع أو سحب" }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  try {
    const result = await recordManualBranchVaultCash({
      branchId: auth.branchId,
      action,
      amount: Number(body.amount),
      notes,
      userId: auth.userId,
    });

    return NextResponse.json({
      message:
        action === "deposit"
          ? `تم إيداع ${result.amount} ج.م في خزنة الفرع (${result.documentNumber})`
          : `تم سحب ${result.amount} ج.م من خزنة الفرع (${result.documentNumber})`,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_VAULT_AMOUNT") {
        return NextResponse.json({ message: "أدخل مبلغاً صحيحاً أكبر من صفر" }, { status: 400 });
      }
      if (error.message === "INSUFFICIENT_VAULT_BALANCE") {
        return NextResponse.json(
          { message: "رصيد خزنة الفرع غير كافٍ للسحب" },
          { status: 400 }
        );
      }
    }
    console.error("manual vault cash error:", error);
    return NextResponse.json({ message: "تعذر تنفيذ حركة الخزنة" }, { status: 500 });
  }
}
