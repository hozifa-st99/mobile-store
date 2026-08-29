import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { buildSupplierAccountStatement } from "@/lib/supplier-account-statement";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const supplierId = new URL(request.url).searchParams.get("supplierId")?.trim();
  if (!supplierId) {
    return NextResponse.json({ message: "معرّف المورد مطلوب" }, { status: 400 });
  }

  try {
    const statement = await buildSupplierAccountStatement(auth.branchId, supplierId);
    if (!statement) {
      return NextResponse.json({ message: "المورد غير موجود" }, { status: 404 });
    }
    return NextResponse.json(statement);
  } catch (error) {
    console.error("supplier statement error:", error);
    return NextResponse.json({ message: "تعذّر تحميل كشف الحساب" }, { status: 500 });
  }
}
