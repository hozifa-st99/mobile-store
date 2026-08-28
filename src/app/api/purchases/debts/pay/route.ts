import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { parseCashSource } from "@/lib/branch-vault";
import { parseLedgerNotes } from "@/lib/credit-ledger-service";
import { prisma } from "@/lib/prisma";
import { purchaseDebtDisplayOutstanding } from "@/lib/purchase-payment-display";
import { recordPurchaseDebtPayment } from "@/lib/purchase-payment-service";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const purchaseId = (body.purchaseId as string | undefined)?.trim();
    const amount = Number(body.amount);
    const cashSource = parseCashSource(body.cashSource);
    const notes = parseLedgerNotes(body.notes);
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    if (!purchaseId) {
      return NextResponse.json({ message: "معرّف الفاتورة مطلوب" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "مبلغ السداد غير صالح" }, { status: 400 });
    }
    if (!cashSource) {
      return NextResponse.json(
        { message: "اختر مصدر الدفع (الوردية أو خزنة الفرع)" },
        { status: 400 }
      );
    }
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ message: "التاريخ غير صالح" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, branchId: auth.branchId, status: "completed" },
      include: {
        supplier: { select: { nameAr: true } },
        creditLedgerEntries: {
          select: { creditAmount: true, paidAmount: true },
          take: 1,
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ message: "الفاتورة غير موجودة" }, { status: 404 });
    }

    const creditEntry = purchase.creditLedgerEntries[0] ?? null;
    const outstanding = purchaseDebtDisplayOutstanding(purchase, creditEntry);
    if (outstanding <= 0.0001) {
      return NextResponse.json({ message: "لا يوجد مبلغ متبقٍ على هذه الفاتورة" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await recordPurchaseDebtPayment(tx, {
        companyId: auth.companyId,
        branchId: auth.branchId,
        userId: auth.userId,
        purchaseId: purchase.id,
        invoiceNumber: purchase.invoiceNumber,
        supplierName: purchase.supplier.nameAr,
        amount,
        cashSource,
        paidAt,
        notes,
      });
    });

    return NextResponse.json({
      message: "تم تسجيل السداد",
      outstanding: Math.max(0, Math.round((outstanding - amount) * 100) / 100),
    });
  } catch (error) {
    console.error("purchase debt payment:", error);
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_VAULT_BALANCE") {
        return NextResponse.json({ message: "رصيد خزنة الفرع غير كافٍ" }, { status: 400 });
      }
      if (error.message === "INVALID_PAYMENT_AMOUNT") {
        return NextResponse.json({ message: "مبلغ السداد يتجاوز المتبقي" }, { status: 400 });
      }
      if (error.message === "CREDIT_ENTRY_NOT_FOUND") {
        return NextResponse.json({ message: "سجل الأجل غير موجود للفاتورة" }, { status: 400 });
      }
    }
    return NextResponse.json({ message: "تعذّر تسجيل السداد" }, { status: 500 });
  }
}
