import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { getNextStocktakeDocumentNumber } from "@/lib/stocktake-document-number-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) return unauthorizedResponse();

    const documentNumber = await getNextStocktakeDocumentNumber(prisma, auth.branchId);
    return NextResponse.json({ documentNumber });
  } catch (error) {
    console.error("next-stocktake-document:", error);
    return NextResponse.json({ message: "تعذر توليد رقم المستند" }, { status: 500 });
  }
}
