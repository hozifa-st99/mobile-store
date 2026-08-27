import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { processSaleReturn } from "@/lib/sale-return-service";

/** Ù…Ø±ØªØ¬Ø¹ Ù‚Ø¯ ÙŠØªØ¶Ù…Ù† Ø¹Ø¯Ø© Ø£ØµÙ†Ø§Ù/Ø£Ø¬Ù‡Ø²Ø© â€” Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ 5 Ø«ÙˆØ§Ù†ÙŠ Ù‚ØµÙŠØ± Ø¹Ù„Ù‰ Vercel */
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
      return NextResponse.json({ message: "Ø§Ø®ØªØ± ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¨ÙŠØ¹" }, { status: 400 });
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
    let message = error instanceof Error ? "DEBUG: " + error.message : "DEBUG: " + String(error);
    if (error instanceof Error) {
      switch (error.message) {
        case "SALE_NOT_FOUND":
          message = "Ù Ø§ØªÙˆØ±Ø© Ø§Ù„Ø¨ÙŠØ¹ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©";
          break;
        case "SALE_NOT_COMPLETED":
          message = "Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©";
          break;
        case "ALREADY_FULLY_RETURNED":
          message = "ØªÙ… Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¨Ø§Ù„ÙƒØ§Ù…Ù„";
          break;
        case "NO_ITEMS_TO_RETURN":
          message = "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ØµÙ†Ø§Ù Ù„Ù„Ø¥Ø±Ø¬Ø§Ø¹";
          break;
        case "ITEM_NOT_FOUND":
          message = "Ø³Ø·Ø± ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯";
          break;
        case "QUANTITY_EXCEEDS_RETURNABLE":
          message = "Ø§Ù„ÙƒÙ…ÙŠØ© Ø£ÙƒØ¨Ø± Ù…Ù† Ø§Ù„Ù…ØªØ§Ø­ Ù„Ù„Ø¥Ø±Ø¬Ø§Ø¹";
          break;
        case "PHONE_QTY_MUST_BE_ONE":
          message = "Ù…Ø±ØªØ¬Ø¹ Ø§Ù„Ù…ÙˆØ¨Ø§ÙŠÙ„ â€” ÙƒÙ…ÙŠØ© 1 ÙÙ‚Ø·";
          break;
        case "PHONE_DEVICE_ID_REQUIRED":
          message = "Ù„Ø§ ÙŠÙˆØ¬Ø¯ IMEI/Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø¹Ù„Ù‰ Ø³Ø·Ø± Ø§Ù„Ø¨ÙŠØ¹";
          break;
        case "PHONE_NOT_SOLD_OR_NOT_FOUND":
          message = "Ø§Ù„Ø¬Ù‡Ø§Ø² ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙƒÙ…Ø¨Ø§Ø¹ â€” ØªØ­Ù‚Ù‚ Ù…Ù† IMEI";
          break;
        case "SALE_RETURN_LEGACY_AMBIGUOUS":
          message =
            "Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø±Ø¬Ø§Ø¹ Ù‡Ø°Ø§ Ø§Ù„Ø¨ÙŠØ¹ â€” Ù†ÙØ³ IMEI Ù„Ù‡ Ø£ÙƒØ«Ø± Ù…Ù† Ø¯ÙˆØ±Ø© Ù…Ø¨Ø§Ø¹Ø©. Ø±Ø§Ø¬Ø¹ Ø§Ù„Ø¯Ø¹Ù… Ø§Ù„ÙÙ†ÙŠ";
          break;
        case "PHONE_SERIAL_NOT_FOUND":
          message = "Ø³Ø¬Ù„ Ø§Ù„Ø¬Ù‡Ø§Ø² ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯";
          break;
        case "ITEM_NO_PRODUCT":
          message = "Ø§Ù„Ø³Ø·Ø± ØºÙŠØ± Ù…Ø±Ø¨ÙˆØ· Ø¨Ù…Ù†ØªØ¬";
          break;
        case "RETURN_NUMBER_ALLOCATE_FAILED":
          message = "ØªØ¹Ø°Ø± ØªØ®ØµÙŠØµ Ø±Ù‚Ù… Ø§Ù„Ù…Ø±ØªØ¬Ø¹";
          break;
        default:
          if (error.message.startsWith("IMEI_DUPLICATE:")) {
            message = `Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹ â€” ÙŠÙˆØ¬Ø¯ Ø¬Ù‡Ø§Ø² Ù†Ø´Ø· Ø¨Ù†ÙØ³ IMEI (${error.message.split(":")[1]})`;
          }
          break;
      }
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
