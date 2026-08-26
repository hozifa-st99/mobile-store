import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

/** البحث عن منتج إكسسوار مسجّل مسبقاً بنفس اسم الكatalog */
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const itemNameId = searchParams.get("itemNameId")?.trim();
  const deviceCondition = searchParams.get("deviceCondition") === "used" ? "used" : "new";

  if (!itemNameId) {
    return NextResponse.json({ message: "itemNameId مطلوب" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: {
      companyId: auth.companyId,
      type: "accessory",
      itemNameId,
      deviceCondition,
      deletedAt: null,
    },
    select: {
      id: true,
      barcode: true,
      nameAr: true,
    },
  });

  return NextResponse.json({ product });
}
