import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { processPurchaseReturn } from "@/lib/purchase-return-service";

/** مرتجع قد يتضمن عدة أصناف/أجهزة — الافتراضي 5 ثواني قصير على Vercel */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const purchaseId = searchParams.get("purchaseId")?.trim();

  const where: { branchId: string; purchaseId?: string } = { branchId: auth.branchId };
  if (purchaseId) where.purchaseId = purchaseId;

  const returns = await prisma.purchaseReturn.findMany({
    where,
    include: {
      purchase: { select: { invoiceNumber: true, supplier: { select: { nameAr: true } } } },
      user: { select: { id: true, fullNameAr: true, username: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ returns });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const purchaseId = String(body.purchaseId || "").trim();
    if (!purchaseId) {
      return NextResponse.json({ message: "اختر فاتورة الشراء" }, { status: 400 });
    }

    const result = await prisma.$transaction(
      async (tx) =>
        processPurchaseReturn(tx, {
          branchId: auth.branchId,
          userId: auth.userId,
          purchaseId,
          notes: body.notes,
          fullReturn: Boolean(body.fullReturn),
          expenseHandling:
            body.expenseHandling === "redistribute" ||
            body.expenseHandling === "daily_expense" ||
            body.expenseHandling === "partial_recovery"
              ? body.expenseHandling
              : undefined,
          expenseRecoveredAmount:
            body.expenseRecoveredAmount != null ? Number(body.expenseRecoveredAmount) : undefined,
          shiftDepositAmount:
            body.shiftDepositAmount != null ? Number(body.shiftDepositAmount) : undefined,
          receivableAmount:
            body.receivableAmount != null ? Number(body.receivableAmount) : undefined,
          items: Array.isArray(body.items)
            ? body.items.map((row: { purchaseItemId?: string; quantity?: number }) => ({
                purchaseItemId: String(row.purchaseItemId || ""),
                quantity: Number(row.quantity) || 0,
              }))
            : undefined,
        }),
      { maxWait: 10_000, timeout: 60_000 }
    );

    return NextResponse.json(
      {
        purchaseReturn: result.purchaseReturn,
        returnStatus: result.returnStatus,
        message: "تم تسجيل المرتجع بنجاح",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Purchase return error:", error);
    let message = "حدث خطأ أثناء تسجيل المرتجع";
    if (error instanceof Error) {
      switch (error.message) {
        case "PURCHASE_NOT_FOUND":
          message = "الفاتورة غير موجودة";
          break;
        case "PURCHASE_NOT_COMPLETED":
          message = "لا يمكن إرجاع فاتورة غير مكتملة";
          break;
        case "ALREADY_FULLY_RETURNED":
          message = "تم إرجاع هذه الفاتورة بالكامل مسبقاً";
          break;
        case "NO_ITEMS_TO_RETURN":
          message = "لا توجد أصناف قابلة للإرجاع";
          break;
        case "QUANTITY_EXCEEDS_RETURNABLE":
          message = "الكمية المطلوبة أكبر من المتاح للإرجاع";
          break;
        case "ITEM_NOT_FOUND":
          message = "صنف غير موجود في الفاتورة";
          break;
        case "ITEM_NO_PRODUCT":
          message = "صنف بدون منتج مرتبط";
          break;
        case "PHONE_QTY_MUST_BE_ONE":
          message = "مرتجع الموبايل يكون جهازاً واحداً فقط";
          break;
        case "INSUFFICIENT_INVENTORY":
          message = "الكمية غير متوفرة في المخزون";
          break;
        case "EXPENSE_HANDLING_REQUIRED":
          message = "اختر طريقة التعامل مع مصروف الفاتورة";
          break;
        case "EXPENSE_RECOVERED_REQUIRED":
          message = "أدخل المبلغ المسترد من المصروف";
          break;
        case "EXPENSE_RECOVERED_EXCEEDS":
          message = "المبلغ المسترد أكبر من حصة المصروف على الأصناف المُرجَعة";
          break;
        case "NO_REMAINING_FOR_REDISTRIBUTE":
          message =
            "لا توجد أصناف متبقية — اختر «نقل للمصروفات اليومية» أو أرجع جزءاً من الفاتورة فقط";
          break;
        case "SETTLEMENT_MISMATCH":
          message = "مجموع التوريد للوردية والمستحق عند المورد يجب أن يساوي المبلغ القابل للتسوية";
          break;
        case "SETTLEMENT_NOT_NEEDED":
          message = "لا يوجد مبلغ نقدي للتسوية على هذا المرتجع";
          break;
        default:
          if (
            error.message.startsWith("لا ") ||
            error.message.startsWith("IMEI") ||
            error.message.startsWith("الجهاز")
          ) {
            message = error.message;
          } else if (
            error.message.includes("Cannot read properties of undefined") ||
            error.message.includes("purchaseReturn")
          ) {
            message =
              "تعذر تسجيل المرتجع — أعد تشغيل السيرفر (RESTART.bat) أو نفّذ npx prisma generate";
          }
      }
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
