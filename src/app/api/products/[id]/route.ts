import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { createRetailPriceChange } from "@/lib/retail-price-change-store";
import {
  getSerialEffectiveRetailPrice,
  roundMoney,
  summarizePriceRange,
} from "@/lib/phone-serial-pricing";
import { loadPhoneProductSerials } from "@/lib/phone-product-serials";
import { formatDeviceImeisSnapshot, getDeviceImeis, formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import { serialWithImeisSelect } from "@/lib/product-serial-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  const inventory = await prisma.branchInventory.findFirst({
    where: {
      branchId: auth.branchId,
      productId: id,
      product: { deletedAt: null, companyId: auth.companyId },
    },
    include: {
      product: { include: { category: true } },
    },
  });

  if (!inventory) {
    return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
  }

  const isPhone = inventory.product.type === "phone";
  const phoneSerials = isPhone
    ? await loadPhoneProductSerials(auth.branchId, id, inventory.retailPrice, {
        availableOnly: true,
        backfillMissing: false,
      })
    : [];

  const allImeis = phoneSerials.flatMap((serial) => serial.imeis);

  const purchasePriceRange =
    isPhone && phoneSerials.length > 0
      ? summarizePriceRange(phoneSerials.map((serial) => serial.purchasePrice))
      : null;
  const retailPriceRange =
    isPhone && phoneSerials.length > 0
      ? summarizePriceRange(phoneSerials.map((serial) => serial.retailPrice))
      : null;

  const phoneQuantity = isPhone ? phoneSerials.length : inventory.quantity;

  if (isPhone && phoneQuantity !== inventory.quantity) {
    await prisma.branchInventory.update({
      where: { id: inventory.id },
      data: { quantity: phoneQuantity },
    });
  }

  return NextResponse.json({
    product: {
      ...inventory.product,
      quantity: phoneQuantity,
      minQuantity: inventory.minQuantity,
      purchasePrice: inventory.purchasePrice,
      retailPrice: inventory.retailPrice,
      wholesalePrice: inventory.wholesalePrice,
      inventoryId: inventory.id,
      purchasePriceRange,
      retailPriceRange,
      phoneSerials,
      availableQuantity: phoneQuantity,
      imeis: allImeis,
    },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    const existing = await prisma.branchInventory.findFirst({
      where: {
        branchId: auth.branchId,
        productId: id,
        product: { deletedAt: null, companyId: auth.companyId },
      },
      include: {
        product: { select: { type: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
    }

    if (existing.product.type === "phone") {
      const serialUpdates = Array.isArray(body.serialUpdates) ? body.serialUpdates : [];
      if (serialUpdates.length === 0) {
        return NextResponse.json({ message: "لم يتغير سعر البيع" });
      }

      const serialIds = serialUpdates
        .map((row: { serialId?: string }) => row.serialId)
        .filter(Boolean) as string[];

      const serials = await prisma.productSerial.findMany({
        where: {
          branchId: auth.branchId,
          productId: id,
          id: { in: serialIds },
          status: "available",
        },
        select: {
          id: true,
          unitCost: true,
          retailPrice: true,
          imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" } },
          purchaseItem: { select: { retailPrice: true } },
          stockEntryItem: { select: { retailPrice: true } },
        },
      });

      const serialMap = new Map(serials.map((serial) => [serial.id, serial]));
      const pendingChanges: Array<{
        serialId: string;
        imei: string | null;
        oldPrice: number;
        newPrice: number;
      }> = [];

      for (const row of serialUpdates) {
        const serialId = String(row.serialId || "");
        const newPrice = roundMoney(Number(row.retailPrice));
        const serial = serialMap.get(serialId);
        if (!serial || !Number.isFinite(newPrice) || newPrice <= 0) continue;

        const oldPrice = getSerialEffectiveRetailPrice(
          {
            unitCost: serial.unitCost,
            retailPrice: serial.retailPrice,
            purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
            stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
          },
          existing.retailPrice
        );

        if (newPrice < serial.unitCost - 0.001) {
          const imeiLabel = formatStoredDeviceImeis(
            formatDeviceImeisSnapshot(getDeviceImeis(serial))
          );
          return NextResponse.json(
            {
              message: `سعر البيع لـ IMEI ${imeiLabel} لا يمكن أن يكون أقل من التكلفة`,
            },
            { status: 400 }
          );
        }

        if (Math.abs(newPrice - oldPrice) > 0.001) {
          pendingChanges.push({
            serialId,
            imei: formatDeviceImeisSnapshot(getDeviceImeis(serial)),
            oldPrice,
            newPrice,
          });
        }
      }

      if (pendingChanges.length === 0) {
        return NextResponse.json({ message: "لم يتغير سعر البيع" });
      }

      if (!reason) {
        return NextResponse.json(
          { message: "يجب إدخال سبب أو ملاحظات عند تغيير سعر البيع" },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const change of pendingChanges) {
          await tx.productSerial.update({
            where: { id: change.serialId },
            data: { retailPrice: change.newPrice },
          });

          await createRetailPriceChange(tx, {
            branchId: auth.branchId,
            productId: id,
            userId: auth.userId,
            serialId: change.serialId,
            imei: change.imei,
            oldPrice: change.oldPrice,
            newPrice: change.newPrice,
            reason,
          });
        }

        const updatedSerials = await tx.productSerial.findMany({
          where: { branchId: auth.branchId, productId: id, status: "available" },
          select: serialWithImeisSelect,
        });

        const retailRange = summarizePriceRange(
          updatedSerials.map((serial) =>
            getSerialEffectiveRetailPrice(
              {
                unitCost: serial.unitCost,
                retailPrice: serial.retailPrice,
                purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
                stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
              },
              existing.retailPrice
            )
          )
        );

        if (retailRange) {
          await tx.branchInventory.update({
            where: { id: existing.id },
            data: { retailPrice: retailRange.min },
          });
        }
      });

      return NextResponse.json({ message: "تم تحديث سعر البيع" });
    }

    const retailPrice = Number(body.retailPrice);
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      return NextResponse.json({ message: "سعر البيع غير صالح" }, { status: 400 });
    }

    if (retailPrice < existing.purchasePrice - 0.001) {
      return NextResponse.json(
        { message: "سعر البيع لا يمكن أن يكون أقل من سعر الشراء (التكلفة)" },
        { status: 400 }
      );
    }

    const priceChanged = Math.abs(retailPrice - existing.retailPrice) > 0.001;
    if (priceChanged && !reason) {
      return NextResponse.json(
        { message: "يجب إدخال سبب أو ملاحظات عند تغيير سعر البيع" },
        { status: 400 }
      );
    }

    if (!priceChanged) {
      return NextResponse.json({ message: "لم يتغير سعر البيع" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.branchInventory.update({
        where: { id: existing.id },
        data: { retailPrice },
      });

      await createRetailPriceChange(tx, {
        branchId: auth.branchId,
        productId: id,
        userId: auth.userId,
        oldPrice: existing.retailPrice,
        newPrice: retailPrice,
        reason,
      });
    });

    return NextResponse.json({ message: "تم تحديث سعر البيع" });
  } catch (error) {
    console.error("Update retail price error:", error);
    return NextResponse.json({ message: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();
  await params;

  return NextResponse.json(
    { message: "حذف المنتجات غير متاح من النظام" },
    { status: 403 }
  );
}
