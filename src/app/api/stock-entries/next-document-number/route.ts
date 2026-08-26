import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getNextStockEntryDocumentNumber } from "@/lib/stock-entry-document-number-server";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) return unauthorizedResponse();

    const documentNumber = await getNextStockEntryDocumentNumber(prisma, auth.branchId);

    return NextResponse.json({ documentNumber });
  } catch (error) {
    console.error("next-stock-entry-document:", error);
    return NextResponse.json({ message: "تعذر توليد رقم المستند" }, { status: 500 });
  }
}
