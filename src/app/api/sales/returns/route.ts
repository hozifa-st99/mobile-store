import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { processSaleReturn } from "@/lib/sale-return-service";

/** مرتجع قد يتضمن عدة أصناف/أجهزة — الافتراضي 5 ثواني قصير على Vercel */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const saleId = searchParams.get("saleId")?.trim();

  const where: { branchId: string; saleId?: string } = { branchId: auth.branchId };
  if (saleId) where.saleId = saleId;

  const returns = await prisma.saleReturn.findMany({
    where,
    include: {
      sale: { select: { invoiceNumber: true, customer: { select: { nameAr: true } } } },
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
    const saleId = String(body.saleId || "").trim();
    if (!saleId) {
      return NextResponse.json({ message: "اختر فاتورة البيع" }, { status: 400 });
    }

    const result = await prisma.$transaction(
      async (tx) =>
        processSaleReturn(tx, {
          branchId: auth.branchId,
          saleId,
          userId: auth.userId,
          notes: body.notes,
          fullReturn: Boolean(body.fullReturn),
          items: Array.isArray(body.items)
            ? body.items.map((row: { saleItemId: string; quantity: number }) => ({
                saleItemId: String(row.saleItemId),
                quantity: Number(row.quantity),
              }))
            : undefined,
        }),
      { maxWait: 10_000, timeout: 60_000 }
    );

    return NextResponse.json(
      {
        saleReturn: result.saleReturn,
        returnStatus: result.returnStatus,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sale return error:", error);
    let message = "حدث خطأ";
    if (error instanceof Error) {
      switch (error.message) {
        case "SALE_NOT_FOUND":
          message = "فاتورة البيع غير موجودة";
          break;
        case "SALE_NOT_COMPLETED":
          message = "الفاتورة غير مكتملة";
          break;
        case "ALREADY_FULLY_RETURNED":
          message = "تم إرجاع الفاتورة بالكامل";
          break;
        case "NO_ITEMS_TO_RETURN":
          message = "لا توجد أصناف للإرجاع";
          break;
        case "ITEM_NOT_FOUND":
          message = "سطر غير موجود";
          break;
        case "QUANTITY_EXCEEDS_RETURNABLE":
          message = "الكمية أكبر من المتاح للإرجاع";
          break;
        case "PHONE_QTY_MUST_BE_ONE":
          message = "مرتجع الموبايل — كمية 1 فقط";
          break;
        case "PHONE_DEVICE_ID_REQUIRED":
          message = "لا يوجد IMEI/باركود على سطر البيع";
          break;
        case "PHONE_NOT_SOLD_OR_NOT_FOUND":
          message = "الجهاز غير موجود كمباع — تحقق من IMEI";
          break;
        case "SALE_RETURN_LEGACY_AMBIGUOUS":
          message =
            "لا يمكن إرجاع هذا البيع — نفس IMEI له أكثر من دورة مباعة. راجع الدعم الفني";
          break;
        case "PHONE_SERIAL_NOT_FOUND":
          message = "سجل الجهاز غير موجود";
          break;
        case "ITEM_NO_PRODUCT":
          message = "السطر غير مربوط بمنتج";
          break;
        case "RETURN_NUMBER_ALLOCATE_FAILED":
          message = "تعذر تخصيص رقم المرتجع";
          break;
        default:
          if (error.message.startsWith("IMEI_DUPLICATE:")) {
            message = `لا يمكن الإرجاع — يوجد جهاز نشط بنفس IMEI (${error.message.split(":")[1]})`;
          }
          break;
      }
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
