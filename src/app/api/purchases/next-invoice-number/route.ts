import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getNextPurchaseInvoiceNumber } from "@/lib/purchase-invoice-number-server";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) return unauthorizedResponse();

    const invoiceNumber = await getNextPurchaseInvoiceNumber(prisma, auth.branchId);

    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    console.error("next-invoice-number:", error);
    return NextResponse.json(
      { message: "تعذر توليد رقم الفاتورة" },
      { status: 500 }
    );
  }
}
