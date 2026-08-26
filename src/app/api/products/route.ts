import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import {
  getSerialEffectivePurchasePrice,
  getSerialEffectiveRetailPrice,
  summarizePriceRange,
} from "@/lib/phone-serial-pricing";
import { filterPhoneSerialsForProduct } from "@/lib/phone-serial-product-filter";
import { normalizeDeviceImeis } from "@/lib/product-serial-imeis";
import { assertBranchImeisAvailable, createPhoneDeviceSerial } from "@/lib/product-serial-service";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const brand = searchParams.get("brand") || "";
  const type = searchParams.get("type") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const deviceCondition = searchParams.get("deviceCondition") || "";

  const inventories = await prisma.branchInventory.findMany({
    where: {
      branchId: auth.branchId,
      product: {
        deletedAt: null,
        isActive: true,
        companyId: auth.companyId,
        ...(brand && { brand }),
        ...(type && { type }),
        ...(categoryId && { categoryId }),
        ...(deviceCondition === "new" || deviceCondition === "used"
          ? { deviceCondition }
          : {}),
        ...(search && {
          OR: [
            { nameAr: { contains: search } },
            { name: { contains: search } },
            { brand: { contains: search } },
            { barcode: { contains: search } },
            { sku: { contains: search } },
          ],
        }),
      },
    },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const phoneProductIds = inventories
    .filter((inv) => inv.product.type === "phone")
    .map((inv) => inv.product.id);

  const phoneSerials =
    phoneProductIds.length > 0
      ? await prisma.productSerial.findMany({
          where: {
            branchId: auth.branchId,
            productId: { in: phoneProductIds },
            status: "available",
          },
          select: {
            productId: true,
            unitCost: true,
            retailPrice: true,
            status: true,
            purchaseItem: { select: { retailPrice: true, productId: true } },
            stockEntryItem: { select: { retailPrice: true, productId: true } },
          },
        })
      : [];

  const serialsByProduct = new Map<string, typeof phoneSerials>();
  for (const serial of phoneSerials) {
    if (!filterPhoneSerialsForProduct([serial], serial.productId).length) continue;
    const list = serialsByProduct.get(serial.productId) ?? [];
    list.push(serial);
    serialsByProduct.set(serial.productId, list);
  }

  for (const inv of inventories) {
    if (inv.product.type !== "phone") continue;
    const availableCount = (serialsByProduct.get(inv.product.id) ?? []).length;
    if (availableCount !== inv.quantity) {
      await prisma.branchInventory.update({
        where: { id: inv.id },
        data: { quantity: availableCount },
      });
      inv.quantity = availableCount;
    }
  }

  const products = inventories.map((inv) => {
    const isPhone = inv.product.type === "phone";
    const serials = isPhone
      ? (serialsByProduct.get(inv.product.id) ?? []).filter((serial) => serial.status === "available")
      : [];

    let purchasePrice = inv.purchasePrice;
    let retailPrice = inv.retailPrice;
    let purchasePriceRange: ReturnType<typeof summarizePriceRange> = null;
    let retailPriceRange: ReturnType<typeof summarizePriceRange> = null;

    if (isPhone && serials.length > 0) {
      purchasePriceRange = summarizePriceRange(
        serials.map((serial) => getSerialEffectivePurchasePrice(serial))
      );
      retailPriceRange = summarizePriceRange(
        serials.map((serial) =>
          getSerialEffectiveRetailPrice(
            {
              unitCost: serial.unitCost,
              retailPrice: serial.retailPrice,
              purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
              stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
            },
            inv.retailPrice
          )
        )
      );
      if (purchasePriceRange?.single) purchasePrice = purchasePriceRange.min;
      if (retailPriceRange?.single) retailPrice = retailPriceRange.min;
    }

    const quantity = isPhone ? serials.length : inv.quantity;

    return {
      id: inv.product.id,
      inventoryId: inv.id,
      name: inv.product.nameAr,
      brand: inv.product.brand,
      model: inv.product.model,
      type: inv.product.type,
      barcode: inv.product.barcode,
      sku: inv.product.sku,
      color: inv.product.color,
      storage: inv.product.storage,
      ram: inv.product.ram,
      imageUrl: inv.product.imageUrl,
      category: inv.product.category?.nameAr,
      quantity,
      minQuantity: inv.minQuantity,
      purchasePrice,
      retailPrice,
      purchasePriceRange,
      retailPriceRange,
      wholesalePrice: inv.wholesalePrice,
      warrantyMonths: inv.product.warrantyMonths,
      deviceCondition: inv.product.deviceCondition,
      phonePlatformId: inv.product.phonePlatformId,
      phoneBrandId: inv.product.phoneBrandId,
      status:
        quantity === 0
          ? "out"
          : quantity <= inv.minQuantity
            ? "low"
            : "available",
    };
  });

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const {
      nameAr,
      brand,
      model,
      type = "phone",
      categoryId,
      barcode,
      sku,
      color,
      storage,
      ram,
      description,
      warrantyMonths = 12,
      imageUrl,
      quantity = 0,
      minQuantity = 5,
      purchasePrice = 0,
      retailPrice = 0,
      wholesalePrice = 0,
      phonePlatformId,
      phoneBrandId,
      phoneModelId,
      imeis = [],
    } = body;

    let finalNameAr = nameAr;
    let finalBrand = brand;

    if (phoneModelId) {
      const phoneModel = await prisma.phoneModel.findFirst({
        where: { id: phoneModelId, companyId: auth.companyId },
        include: { brand: true, platform: true },
      });
      if (phoneModel) {
        finalNameAr = phoneModel.nameAr;
        finalBrand = phoneModel.brand?.nameAr || phoneModel.platform.nameAr;
      }
    }

    if (!finalNameAr || !finalBrand) {
      return NextResponse.json(
        { message: "اسم المنتج والشركة المصنعة مطلوبان" },
        { status: 400 }
      );
    }

    const normalizedImeis = normalizeDeviceImeis(Array.isArray(imeis) ? imeis : []);

    if (type === "phone" && normalizedImeis.length === 0) {
      return NextResponse.json({ message: "أدخل IMEI واحد على الأقل للموبايل" }, { status: 400 });
    }

    const product = await prisma.$transaction(async (tx) => {
      if (type === "phone") {
        await assertBranchImeisAvailable(tx, auth.branchId, normalizedImeis);
      }

      const created = await tx.product.create({
        data: {
          companyId: auth.companyId,
          categoryId: categoryId || null,
          type,
          name: finalNameAr,
          nameAr: finalNameAr,
          brand: finalBrand,
          phonePlatformId: phonePlatformId || null,
          phoneBrandId: phoneBrandId || null,
          phoneModelId: phoneModelId || null,
          model: model || null,
          barcode: barcode || null,
          sku: sku || null,
          color: color || null,
          storage: storage || null,
          ram: ram || null,
          description: description || null,
          warrantyMonths,
          imageUrl: imageUrl || null,
          inventories: {
            create: {
              branchId: auth.branchId,
              quantity: type === "phone" ? 1 : quantity,
              minQuantity,
              purchasePrice,
              retailPrice,
              wholesalePrice,
            },
          },
        },
        include: {
          inventories: { where: { branchId: auth.branchId } },
          category: true,
        },
      });

      if (type === "phone") {
        await createPhoneDeviceSerial(tx, {
          branchId: auth.branchId,
          productId: created.id,
          imeis: normalizedImeis,
          unitCost: purchasePrice,
          retailPrice,
          barcode: barcode || null,
        });
      }

      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("IMEI_DUPLICATE:")) {
        const imei = error.message.split(":")[1];
        return NextResponse.json({ message: `IMEI مكرر: ${imei}` }, { status: 400 });
      }
      if (error.message.startsWith("IMEI_INVALID:")) {
        const imei = error.message.split(":")[1];
        return NextResponse.json(
          { message: `IMEI غير صالح (8–20 رقم): ${imei}` },
          { status: 400 }
        );
      }
      if (error.message === "IMEI_REQUIRED") {
        return NextResponse.json({ message: "أدخل IMEI واحد على الأقل" }, { status: 400 });
      }
    }
    console.error("Create product error:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء إضافة المنتج" }, { status: 500 });
  }
}
