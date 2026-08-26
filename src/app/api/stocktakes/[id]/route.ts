import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getStocktakeDetail } from "@/lib/stocktake-service";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import {
  parseStocktakeSerials,
  stocktakeSerialsToLineSerials,
} from "@/lib/stocktake-serial-snapshot";
type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const stocktake = await getStocktakeDetail(auth.branchId, auth.companyId, id);
    if (!stocktake) {
      return NextResponse.json({ message: "مستند الجرد غير موجود" }, { status: 404 });
    }

    const productIds = (stocktake.items ?? []).map((item) => item.productId);
    const products =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds }, companyId: auth.companyId },
            select: {
              id: true,
              type: true,
              nameAr: true,
              brand: true,
              phoneModelId: true,
              color: true,
              storage: true,
              ram: true,
              deviceCondition: true,
              boxCondition: true,
              batteryPercent: true,
            },
          })
        : [];
    const productById = new Map(products.map((product) => [product.id, product]));

    return NextResponse.json({
      stocktake: {
        id: stocktake.id,
        documentNumber: stocktake.documentNumber,
        stocktakeDate: stocktake.stocktakeDate,
        mode: stocktake.mode,
        notes: stocktake.notes,
        totalSystemQty: stocktake.totalSystemQty,
        totalCountedQty: stocktake.totalCountedQty,
        totalVariance: stocktake.totalVariance,
        userName: stocktake.user?.fullNameAr || stocktake.user?.username || null,
        items: (stocktake.items ?? []).map((item) => {
          const savedSerials = parseStocktakeSerials(item.serialsSnapshot);
          const serials =
            savedSerials.length > 0
              ? stocktakeSerialsToLineSerials(savedSerials, item.productId)
              : [];
          return {
            id: item.id,
            productId: item.productId,
            description: item.description,
            barcode: item.barcode,
            imeis: parseImeisSnapshot(item.imeiSnapshot),
            serialsSnapshot: item.serialsSnapshot,
            serials,
            systemQuantity: item.systemQuantity,
            countedQuantity: item.countedQuantity,
            variance: item.variance,
            unitCost: item.unitCost,
            product: productById.get(item.productId) ?? null,
          };
        }),
      },
    });  } catch (error) {
    console.error("stocktake detail:", error);
    return NextResponse.json({ message: "تعذر تحميل مستند الجرد" }, { status: 500 });
  }
}
