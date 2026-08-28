import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { parseLedgerNotes } from "@/lib/credit-ledger-service";
import { prisma } from "@/lib/prisma";
import { recordPurchaseReceivableCollection } from "@/lib/purchase-receivable-service";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const receivableId = (body.receivableId as string | undefined)?.trim();
    const amount = Number(body.amount);
    const notes = parseLedgerNotes(body.notes);
    const collectedAt = body.collectedAt ? new Date(body.collectedAt) : new Date();

    if (!receivableId) {
      return NextResponse.json({ message: "معرّف المستحق مطلوب" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "مبلغ التحصيل غير صالح" }, { status: 400 });
    }
    if (Number.isNaN(collectedAt.getTime())) {
      return NextResponse.json({ message: "التاريخ غير صالح" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) =>
      recordPurchaseReceivableCollection(tx, {
        branchId: auth.branchId,
        userId: auth.userId,
        receivableId,
        amount,
        notes,
        collectedAt,
      })
    );

    return NextResponse.json({
      message: "تم تسجيل التحصيل في الوردية",
      outstanding: result.outstanding,
    });
  } catch (error) {
    console.error("purchase receivable collection:", error);
    if (error instanceof Error) {
      if (error.message === "RECEIVABLE_NOT_FOUND") {
        return NextResponse.json({ message: "المستحق غير موجود" }, { status: 404 });
      }
      if (error.message === "INVALID_COLLECTION_AMOUNT") {
        return NextResponse.json({ message: "مبلغ التحصيل يتجاوز المتبقي" }, { status: 400 });
      }
    }
    return NextResponse.json({ message: "تعذّر تسجيل التحصيل" }, { status: 500 });
  }
}
