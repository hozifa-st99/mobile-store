import { NextRequest, NextResponse } from "next/server";
import {
  generateUniqueProductBarcode,
  isBarcodeTaken,
} from "@/lib/barcode-server";
import { getCompanyAuthFromRequest, getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth =
    (await getCompanyAuthFromRequest(request)) || (await getAuthFromRequest(request));
  if (!auth?.companyId) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const nameHint = typeof body.nameHint === "string" ? body.nameHint : undefined;
    const barcode = await generateUniqueProductBarcode(prisma, auth.companyId, nameHint);

    if (await isBarcodeTaken(prisma, auth.companyId, barcode)) {
      throw new Error("BARCODE_COLLISION");
    }

    return NextResponse.json({ barcode });
  } catch (error) {
    console.error("barcode generate:", error);
    return NextResponse.json({ message: "تعذر توليد باركود فريد" }, { status: 500 });
  }
}
