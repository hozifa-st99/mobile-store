import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { completeStocktake } from "@/lib/stocktake-service";

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const mode = body.mode === "partial" ? "partial" : "full";
    const items = Array.isArray(body.items) ? body.items : [];

    const result = await completeStocktake({
      branchId: auth.branchId,
      userId: auth.userId,
      companyId: auth.companyId,
      mode,
      notes: typeof body.notes === "string" ? body.notes : null,
      documentNumber: typeof body.documentNumber === "string" ? body.documentNumber : undefined,
      items: items.map((item: Record<string, unknown>) => ({
        productId: String(item.productId || ""),
        description: String(item.description || ""),
        barcode: item.barcode != null ? String(item.barcode) : null,
        imeis: Array.isArray(item.imeis)
          ? item.imeis.map((v) => String(v).trim()).filter(Boolean)
          : [],
        presentSerialIds: Array.isArray(item.presentSerialIds)
          ? item.presentSerialIds.map((v) => String(v).trim()).filter(Boolean)
          : [],
        absentSerialIds: Array.isArray(item.absentSerialIds)
          ? item.absentSerialIds.map((v) => String(v).trim()).filter(Boolean)
          : [],
        serials: Array.isArray(item.serials)
          ? item.serials
              .map((raw: Record<string, unknown>) => ({
                id: String(raw.id || "").trim(),
                imei: raw.imei != null ? String(raw.imei).trim() || null : null,
                imeis: Array.isArray(raw.imeis)
                  ? raw.imeis.map((v) => String(v).trim()).filter(Boolean)
                  : [],
                barcode: raw.barcode != null ? String(raw.barcode).trim() || null : null,
                unitCost: Number(raw.unitCost) || 0,
                present: raw.present !== false,
              }))
              .filter((row) => row.id)
          : [],
        systemQuantity: Number(item.systemQuantity) || 0,
        countedQuantity: Number(item.countedQuantity) || 0,
        unitCost: Number(item.unitCost) || 0,
      })),
    });

    return NextResponse.json({ stocktake: result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NO_ITEMS") {
      return NextResponse.json({ message: "يجب إضافة صنف واحد على الأقل" }, { status: 400 });
    }
    if (code === "INVALID_COUNT") {
      return NextResponse.json({ message: "الرصيد الفعلي لا يمكن أن يكون سالباً" }, { status: 400 });
    }
    if (code === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "أحد الأصناف غير موجود في المخزون" }, { status: 400 });
    }
    if (code === "STOCKTAKE_SERIAL_DELETE_FAILED") {
      return NextResponse.json(
        { message: "تعذر حذف الجهاز المفقود من المخزون — حدّث الصفحة وحاول مرة أخرى" },
        { status: 400 }
      );
    }
    console.error("complete stocktake:", error);
    return NextResponse.json({ message: "تعذر اعتماد الجرد" }, { status: 500 });
  }
}
