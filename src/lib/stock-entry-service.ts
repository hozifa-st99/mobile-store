import type { Prisma } from "@prisma/client";

import { ensureUniqueBarcode } from "@/lib/barcode-server";
import { documentRecordedAt } from "@/lib/document-datetime";
import { isIphonePlatform } from "@/lib/iphone-platform";
import {
  buildAccessoryPurchaseDescription,
  resolveOrCreateAccessoryProduct,
} from "@/lib/item-product";
import { getModelOptionLists } from "@/lib/phone-model-options";
import { phoneModelSpecsInclude } from "@/lib/phone-model-specs";
import {
  buildPurchaseItemDescription,
  resolveOrCreatePhoneProduct,
} from "@/lib/phone-product";
import {
  PHONE_SPEC_ERROR_MESSAGES,
  resolveSpecRequirements,
  validatePhoneLineSpecs,
} from "@/lib/phone-model-requirements";
import { allocateStockEntryDocumentNumber } from "@/lib/stock-entry-document-number-server";
import { setStockEntryItemImeisSnapshot } from "@/lib/stock-entry-item-fields";
import { matchPurchaseLinesToResolved } from "@/lib/purchase-line-match";
import { parseTaxStatus } from "@/lib/phone-device-display";
import { computeWeightedAverageCost } from "@/lib/weighted-average-cost";
import {
  assertBranchImeisAvailable,
  createPhoneDeviceSerial,
} from "@/lib/product-serial-service";

type Tx = Prisma.TransactionClient;

export interface StockEntryLineInput {
  lineType?: "phone" | "accessory";
  phoneModelId?: string;
  productName?: string;
  itemCategoryId?: string | null;
  itemBrandId?: string | null;
  itemNameId?: string | null;
  color?: string;
  storage?: string;
  ram?: string;
  quantity: number;
  unitPrice: number;
  retailPrice?: number;
  minQuantity?: number;
  barcode?: string;
  imeis?: string[];
  warrantyMonths?: number;
  taxStatus?: string;
  deviceCondition?: "new" | "used";
  boxCondition?: string | null;
  batteryPercent?: number | null;
  itemNotes?: string | null;
}

interface ResolvedStockLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  barcode: string | null;
  warrantyMonths: number;
  deviceCondition: string;
  boxCondition: string | null;
  batteryPercent: number | null;
  itemNotes: string | null;
  imeis: string[];
  minQuantity: number | null;
}

async function resolveStockEntryLines(
  tx: Tx,
  auth: { companyId: string; branchId: string },
  items: StockEntryLineInput[]
): Promise<ResolvedStockLine[]> {
  const resolvedItems: ResolvedStockLine[] = [];

  for (const item of items) {
    let productId: string | null = null;
    let description = "";
    const deviceCondition = item.deviceCondition || "new";
    const retailPrice = item.retailPrice ?? (item.unitPrice > 0 ? item.unitPrice * 1.15 : 0);
    const lineType =
      item.lineType || (item.phoneModelId ? "phone" : item.productName ? "accessory" : "phone");

    if (lineType === "phone" && item.phoneModelId) {
      const phoneModel = await tx.phoneModel.findFirst({
        where: { id: item.phoneModelId, companyId: auth.companyId, isActive: true },
        include: { ...phoneModelSpecsInclude, platform: true, brand: true },
      });

      if (!phoneModel) throw new Error("PHONE_MODEL_NOT_FOUND");

      const specs = getModelOptionLists(phoneModel);
      const requirements = resolveSpecRequirements({
        platform: phoneModel.platform,
        brand: phoneModel.brand,
      });
      const specError = validatePhoneLineSpecs(specs, requirements, item);
      if (specError) throw new Error(specError);
      if (deviceCondition === "used") {
        if (!item.boxCondition) throw new Error("BOX_CONDITION_REQUIRED");
        if (isIphonePlatform(phoneModel.platform) && item.batteryPercent == null) {
          throw new Error("BATTERY_REQUIRED");
        }
      }

      const imeis = (item.imeis || []).map((i) => i.trim()).filter(Boolean);
      if (imeis.length === 0) throw new Error("IMEI_REQUIRED");

      for (const imei of imeis) {
        await assertBranchImeisAvailable(tx, auth.branchId, [imei]);
      }

      const barcode = await ensureUniqueBarcode(
        tx,
        auth.companyId,
        item.barcode,
        phoneModel.nameAr
      );

      const product = await resolveOrCreatePhoneProduct(tx, auth, {
        phoneModelId: item.phoneModelId,
        color: item.color,
        storage: item.storage,
        ram: item.ram,
        unitPrice: item.unitPrice,
        retailPrice,
        barcode,
        warrantyMonths: item.warrantyMonths,
        taxStatus: parseTaxStatus(item.taxStatus),
        deviceCondition,
        boxCondition: item.boxCondition,
        batteryPercent: item.batteryPercent,
        itemNotes: item.itemNotes,
      });

      productId = product.id;
      description = buildPurchaseItemDescription(phoneModel.nameAr, {
        color: item.color,
        storage: item.storage,
        ram: item.ram,
        deviceCondition,
        boxCondition: item.boxCondition,
        batteryPercent: item.batteryPercent,
      });

      resolvedItems.push({
        productId,
        description,
        quantity: 1,
        unitPrice: item.unitPrice,
        retailPrice,
        barcode,
        warrantyMonths: item.warrantyMonths ?? 12,
        deviceCondition,
        boxCondition: deviceCondition === "used" ? item.boxCondition || null : null,
        batteryPercent: deviceCondition === "used" ? item.batteryPercent ?? null : null,
        itemNotes: item.itemNotes?.trim() || null,
        imeis,
        minQuantity: null,
      });
      continue;
    }

    if (lineType === "accessory" && (item.itemNameId || item.productName?.trim())) {
      let categoryName = "";
      let brandName = "";
      let productName = item.productName?.trim() || "";

      if (item.itemCategoryId) {
        const category = await tx.itemCategory.findFirst({
          where: { id: item.itemCategoryId, companyId: auth.companyId, isActive: true },
          include: {
            brands: {
              where: { isActive: true },
              include: { names: { where: { isActive: true } } },
            },
          },
        });
        if (!category) throw new Error("ITEM_CATEGORY_NOT_FOUND");
        categoryName = category.nameAr;

        if (item.itemBrandId) {
          const brand = category.brands.find((b) => b.id === item.itemBrandId);
          if (!brand) throw new Error("ITEM_BRAND_NOT_FOUND");
          brandName = brand.nameAr;

          if (item.itemNameId) {
            const catalogName = brand.names.find((n) => n.id === item.itemNameId);
            if (!catalogName) throw new Error("ITEM_NAME_NOT_FOUND");
            productName = catalogName.nameAr;
          } else if (brand.names.length > 0) {
            throw new Error("ITEM_NAME_REQUIRED");
          }
        } else if (category.brands.length > 0) {
          throw new Error("ITEM_BRAND_REQUIRED");
        }
      }

      if (!productName) throw new Error("ACCESSORY_NAME_REQUIRED");

      const product = await resolveOrCreateAccessoryProduct(tx, auth, {
        itemCategoryId: item.itemCategoryId,
        itemBrandId: item.itemBrandId,
        itemNameId: item.itemNameId,
        nameAr: productName,
        unitPrice: item.unitPrice,
        retailPrice,
        barcode: item.barcode,
        deviceCondition,
        itemNotes: item.itemNotes,
        minQuantity: item.minQuantity,
      });

      resolvedItems.push({
        productId: product.id,
        description: buildAccessoryPurchaseDescription(
          productName,
          categoryName || undefined,
          brandName || undefined
        ),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        retailPrice,
        barcode: product.barcode,
        warrantyMonths: 12,
        deviceCondition,
        boxCondition: null,
        batteryPercent: null,
        itemNotes: item.itemNotes?.trim() || null,
        imeis: [],
        minQuantity: item.minQuantity ?? 5,
      });
      continue;
    }

    throw new Error("LINE_INVALID");
  }

  return resolvedItems;
}

async function applyStockEntryInventory(
  tx: Tx,
  branchId: string,
  resolvedItems: ResolvedStockLine[],
  entryItems: { id: string }[]
) {
  for (let i = 0; i < resolvedItems.length; i++) {
    const item = resolvedItems[i];
    const entryLine = entryItems[i];
    if (!item?.productId || !entryLine) continue;

    const isPhoneLine = item.imeis.length > 0;

    const existingInv = await tx.branchInventory.findUnique({
      where: {
        branchId_productId: { branchId, productId: item.productId },
      },
      select: { quantity: true, purchasePrice: true },
    });

    const purchasePrice = isPhoneLine
      ? (existingInv?.purchasePrice ?? item.unitPrice)
      : computeWeightedAverageCost(
          existingInv?.quantity ?? 0,
          existingInv?.purchasePrice ?? 0,
          item.quantity,
          item.unitPrice
        );

    await tx.branchInventory.upsert({
      where: {
        branchId_productId: { branchId, productId: item.productId },
      },
      update: {
        quantity: { increment: item.quantity },
        ...(!isPhoneLine ? { purchasePrice } : {}),
        retailPrice: item.retailPrice,
        ...(item.minQuantity != null ? { minQuantity: item.minQuantity } : {}),
      },
      create: {
        branchId,
        productId: item.productId,
        quantity: item.quantity,
        purchasePrice: item.unitPrice,
        retailPrice: item.retailPrice,
        minQuantity: item.minQuantity ?? 5,
      },
    });

    if (item.imeis.length > 0) {
      const lineUnitCost = Math.round(item.unitPrice * 100) / 100;
      const lineBarcode = item.barcode?.trim() || null;
      await createPhoneDeviceSerial(tx, {
        branchId,
        productId: item.productId,
        stockEntryItemId: entryLine.id,
        imeis: item.imeis,
        unitCost: lineUnitCost,
        retailPrice: item.retailPrice,
        barcode: lineBarcode,
      });
    }
  }
}

export async function createStockEntry(
  tx: Tx,
  auth: { companyId: string; branchId: string },
  input: {
    documentNumber?: string;
    entryDate?: string;
    notes?: string | null;
    items: StockEntryLineInput[];
  }
) {
  if (!input.items.length) throw new Error("ITEMS_REQUIRED");

  const resolvedItems = await resolveStockEntryLines(tx, auth, input.items);
  const subtotal = resolvedItems.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const total = subtotal;

  const finalDocumentNumber = await allocateStockEntryDocumentNumber(
    tx,
    auth.branchId,
    input.documentNumber
  );

  const entry = await tx.stockEntry.create({
    data: {
      branchId: auth.branchId,
      documentNumber: finalDocumentNumber,
      entryDate: documentRecordedAt(),
      status: "completed",
      subtotal,
      total,
      notes: input.notes?.trim() || null,
      items: {
        create: resolvedItems.map((row) => ({
          ...(row.productId ? { product: { connect: { id: row.productId } } } : {}),
          description: row.description,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          retailPrice: row.retailPrice,
          total: row.quantity * row.unitPrice,
          barcode: row.barcode,
          warrantyMonths: row.warrantyMonths,
          deviceCondition: row.deviceCondition,
          boxCondition: row.boxCondition,
          batteryPercent: row.batteryPercent,
          itemNotes: row.itemNotes,
        })),
      },
    },
    include: { items: true },
  });

  const matchedEntryLines = matchPurchaseLinesToResolved(resolvedItems, entry.items);

  for (let i = 0; i < resolvedItems.length; i++) {
    const imeis = resolvedItems[i]?.imeis ?? [];
    if (imeis.length > 0) {
      await setStockEntryItemImeisSnapshot(tx, matchedEntryLines[i].id, imeis);
    }
  }

  await applyStockEntryInventory(tx, auth.branchId, resolvedItems, matchedEntryLines);

  return entry;
}

export function mapStockEntryError(error: unknown): string {
  return getStockEntryErrorResponse(error).message;
}

export function getStockEntryErrorResponse(error: unknown): {
  message: string;
  status: number;
} {
  if (!(error instanceof Error)) {
    return { message: "حدث خطأ", status: 500 };
  }

  const map: Record<string, string> = {
    ITEMS_REQUIRED: "أضف أصناف على الأقل",
    PHONE_MODEL_NOT_FOUND: "الموديل غير موجود",
    ...PHONE_SPEC_ERROR_MESSAGES,
    BOX_CONDITION_REQUIRED: "اختر حالة الكارتونة للمستعمل",
    BATTERY_REQUIRED: "أدخل نسبة البطارية — iPhone مستعمل",
    IMEI_REQUIRED: "أدخل IMEI واحد على الأقل",
    ITEM_CATEGORY_NOT_FOUND: "تصنيف الصنف غير موجود",
    ITEM_BRAND_NOT_FOUND: "العلامة التجارية غير موجودة",
    ITEM_BRAND_REQUIRED: "اختر العلامة التجارية",
    ITEM_NAME_REQUIRED: "اختر اسم الصنف من القائمة",
    ITEM_NAME_NOT_FOUND: "اسم الصنف غير موجود",
    ITEM_NAME_BRAND_MISMATCH: "اسم الصنف لا يتبع العلامة التجارية المختارة",
    ACCESSORY_NAME_REQUIRED: "أدخل أو اختر اسم الصنف",
    DOCUMENT_NUMBER_ALLOCATE_FAILED: "تعذر تخصيص رقم المستند",
    LINE_INVALID: "صنف غير صالح في المستند",
    PURCHASE_LINE_MATCH_FAILED: "تعذر ربط بنود المستند — حدّث الصفحة وحاول مرة أخرى",
    SERIAL_PRODUCT_MISMATCH: "تعارض بين الصنف وبند المستند",
    BRANCH_NOT_FOUND: "الفرع غير موجود",
  };

  if (error.message.startsWith("IMEI_DUPLICATE:")) {
    return {
      message: `IMEI مسجل مسبقاً: ${error.message.split(":")[1]}`,
      status: 400,
    };
  }
  if (error.message.startsWith("IMEI_INVALID:")) {
    return {
      message: `IMEI غير صالح (8–20 رقم): ${error.message.split(":")[1]}`,
      status: 400,
    };
  }

  const mapped = map[error.message];
  if (mapped) {
    return { message: mapped, status: 400 };
  }

  return { message: "حدث خطأ أثناء حفظ المستند", status: 500 };
}
