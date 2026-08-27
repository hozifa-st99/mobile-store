import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { allocatePurchaseInvoiceNumber } from "@/lib/purchase-invoice-number-server";
import { ensureUniqueBarcode } from "@/lib/barcode-server";
import {
  buildAccessoryPurchaseDescription,
  resolveOrCreateAccessoryProduct,
} from "@/lib/item-product";
import { buildPurchaseItemDescription, resolveOrCreatePhoneProduct } from "@/lib/phone-product";
import {
  resolveSpecRequirements,
  validatePhoneLineSpecs,
} from "@/lib/phone-model-requirements";
import { getModelOptionLists } from "@/lib/phone-model-options";
import { phoneModelSpecsInclude } from "@/lib/phone-model-specs";
import { isIphonePlatform } from "@/lib/iphone-platform";
import { setUnitPriceBefore } from "@/lib/purchase-item-price-before";
import { setImeisSnapshot, readPurchaseReturnStatus } from "@/lib/purchase-item-return-fields";
import { documentRecordedAt } from "@/lib/document-datetime";
import { compareNewestDocumentFirst } from "@/lib/document-list-sort";
import { computeWeightedAverageCost } from "@/lib/weighted-average-cost";
import {
  assertBranchImeisAvailable,
  createPhoneDeviceSerial,
} from "@/lib/product-serial-service";
import { matchPurchaseLinesToResolved } from "@/lib/purchase-line-match";
import {
  PURCHASE_PAYMENT_TYPE_LABELS,
  purchaseSettlementLabel,
  roundPurchaseMoney,
} from "@/lib/purchase-payment-display";
import {
  applyPurchasePaymentSideEffects,
  parsePurchasePaymentBody,
  validatePurchasePaymentInput,
} from "@/lib/purchase-payment-service";
import { attachInvoiceCreators, listDistinctInvoiceCreators } from "@/lib/invoice-creator-server";
import { getOrCreateIndividualCustomerSupplier } from "@/lib/individual-customer-supplier";
import { parseTaxStatus } from "@/lib/phone-device-display";
import { SUPPLIER_KIND_WHOLESALE } from "@/lib/supplier-kind";

/** فاتورة كبيرة = استعلامات متتالية على Vercel؛ الافتراضي 5 ثواني قصير جداً */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
  const invoiceNumber = searchParams.get("invoiceNumber")?.trim();
  const supplierId = searchParams.get("supplierId")?.trim();
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const returnableOnly = searchParams.get("returnableOnly") === "true";
  const paymentTypeFilter = searchParams.get("paymentType")?.trim();
  const createdByUserId = searchParams.get("createdByUserId")?.trim();

  const where: {
    branchId: string;
    invoiceNumber?: { contains: string };
    supplierId?: string;
    purchaseDate?: { gte?: Date; lte?: Date };
    status?: string;
    paymentType?: string;
    createdByUserId?: string;
  } = { branchId: auth.branchId };

  if (returnableOnly) {
    where.status = "completed";
  }

  if (invoiceNumber) {
    where.invoiceNumber = { contains: invoiceNumber };
  }
  if (supplierId) {
    where.supplierId = supplierId;
  }
  if (createdByUserId) {
    where.createdByUserId = createdByUserId;
  }
  if (
    paymentTypeFilter === "full_cash" ||
    paymentTypeFilter === "credit" ||
    paymentTypeFilter === "partial_credit"
  ) {
    where.paymentType = paymentTypeFilter;
  }
  if (dateFrom || dateTo) {
    where.purchaseDate = {};
    if (dateFrom) where.purchaseDate.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.purchaseDate.lte = end;
    }
  }

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: true,
    },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });

  purchases.sort((a, b) =>
    compareNewestDocumentFirst(a.purchaseDate, a.createdAt, b.purchaseDate, b.createdAt)
  );

  const returnStatusMap = await readPurchaseReturnStatus(
    prisma,
    purchases.map((p) => p.id)
  );

  const purchasesWithCreators = await attachInvoiceCreators(prisma, purchases);

  const enriched = purchasesWithCreators.map((p) => {
    const outstanding = roundPurchaseMoney(Math.max(0, p.total - p.paidAmount));
    const settlement = purchaseSettlementLabel(p.paymentType, p.total, p.paidAmount);
    return {
      ...p,
      returnStatus: returnStatusMap[p.id] ?? "none",
      outstanding,
      paymentTypeLabel: PURCHASE_PAYMENT_TYPE_LABELS[p.paymentType] || p.paymentType,
      settlementLabel: settlement.label,
      settlementTone: settlement.tone,
    };
  });

  const filtered = returnableOnly
    ? enriched.filter((p) => p.returnStatus !== "full")
    : enriched;

  const invoiceCreators = await listDistinctInvoiceCreators(prisma, auth.branchId, "purchase");

  return NextResponse.json({
    purchases: filtered.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      purchaseDate: p.purchaseDate,
      status: p.status,
      returnStatus: p.returnStatus,
      total: p.total,
      paidAmount: p.paidAmount,
      outstanding: p.outstanding,
      paymentType: p.paymentType,
      paymentTypeLabel: p.paymentTypeLabel,
      settlementLabel: p.settlementLabel,
      settlementTone: p.settlementTone,
      supplier: { id: p.supplier.id, nameAr: p.supplier.nameAr },
      createdBy: p.createdBy,
    })),
    invoiceCreators,
  });
  } catch (err) {
    console.error("GET /api/purchases failed:", err);
    return NextResponse.json(
      { message: "تعذر تحميل فواتير المشتريات", purchases: [], invoiceCreators: [] },
      { status: 500 }
    );
  }
}

interface PurchaseLineInput {
  lineType?: "phone" | "accessory";
  phoneModelId?: string;
  productId?: string;
  description?: string;
  productName?: string;
  itemCategoryId?: string | null;
  itemBrandId?: string | null;
  itemNameId?: string | null;
  color?: string;
  storage?: string;
  ram?: string;
  quantity: number;
  unitPrice: number;
  unitPriceBefore?: number;
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

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const {
      supplierId: bodySupplierId,
      invoiceNumber,
      dueDate,
      notes,
      discount = 0,
      taxRate = 14,
      applyTax = true,
      items = [],
      status = "completed",
      counterpartyMode,
      customerId: bodyCustomerId,
    } = body;

    const isCustomerCounterparty = counterpartyMode === "customer";

    if (isCustomerCounterparty) {
      if (!bodyCustomerId?.trim()) {
        return NextResponse.json({ message: "اختر العميل" }, { status: 400 });
      }
    } else if (!bodySupplierId) {
      return NextResponse.json(
        { message: "المورد ورقم الفاتورة والأصناف مطلوبة" },
        { status: 400 }
      );
    }

    if (!invoiceNumber || items.length === 0) {
      return NextResponse.json(
        { message: "المورد ورقم الفاتورة والأصناف مطلوبة" },
        { status: 400 }
      );
    }

    let resolvedSupplierId = bodySupplierId as string | undefined;

    if (isCustomerCounterparty) {
      const shadowSupplier = await getOrCreateIndividualCustomerSupplier(
        prisma,
        auth.companyId,
        bodyCustomerId.trim()
      );
      resolvedSupplierId = shadowSupplier.id;
    } else {
      const wholesaleSupplier = await prisma.supplier.findFirst({
        where: {
          id: bodySupplierId,
          companyId: auth.companyId,
          isActive: true,
          supplierKind: SUPPLIER_KIND_WHOLESALE,
        },
        select: { id: true },
      });
      if (!wholesaleSupplier) {
        return NextResponse.json({ message: "المورد غير صالح" }, { status: 400 });
      }
      resolvedSupplierId = wholesaleSupplier.id;
    }

    if (!resolvedSupplierId) {
      return NextResponse.json(
        { message: "المورد ورقم الفاتورة والأصناف مطلوبة" },
        { status: 400 }
      );
    }

    const duplicateInvoice = await prisma.purchase.findFirst({
      where: { branchId: auth.branchId, invoiceNumber: invoiceNumber.trim() },
      select: { id: true },
    });
    if (duplicateInvoice) {
      return NextResponse.json(
        { message: "رقم الفاتورة مستخدم — حدّث الصفحة للحصول على رقم جديد" },
        { status: 400 }
      );
    }

    const subtotal = items.reduce(
      (sum: number, item: PurchaseLineInput) => sum + item.quantity * item.unitPrice,
      0
    );
    const effectiveTaxRate = applyTax ? taxRate : 0;
    const taxAmount = ((subtotal - discount) * effectiveTaxRate) / 100;
    const total = subtotal - discount + taxAmount;

    const { paymentType, paidAmountInput, cashSource } = parsePurchasePaymentBody(body);
    const paymentValidation = validatePurchasePaymentInput(
      total,
      paymentType,
      paidAmountInput,
      cashSource
    );
    if ("error" in paymentValidation) {
      return NextResponse.json({ message: paymentValidation.error }, { status: 400 });
    }
    const { paidAmount, creditAmount } = paymentValidation;

    const purchase = await prisma.$transaction(async (tx) => {
      const resolvedItems: {
        productId: string | null;
        description: string;
        quantity: number;
        unitPrice: number;
        unitPriceBefore: number | null;
        retailPrice: number;
        barcode: string | null;
        warrantyMonths: number;
        taxStatus: string;
        deviceCondition: string;
        boxCondition: string | null;
        batteryPercent: number | null;
        itemNotes: string | null;
        imeis: string[];
        minQuantity: number | null;
      }[] = [];

      for (const item of items as PurchaseLineInput[]) {
        let productId = item.productId || null;
        let description = item.description || "";
        const deviceCondition = item.deviceCondition || "new";
        const retailPrice = item.retailPrice ?? (item.unitPrice > 0 ? item.unitPrice * 1.15 : 0);
        const lineType =
          item.lineType || (item.phoneModelId ? "phone" : item.productName ? "accessory" : "phone");

        if (lineType === "phone" && item.phoneModelId) {
          const phoneModel = await tx.phoneModel.findFirst({
            where: { id: item.phoneModelId, companyId: auth.companyId, isActive: true },
            include: {
              ...phoneModelSpecsInclude,
              platform: true,
              brand: true,
            },
          });

          if (!phoneModel) {
            throw new Error("PHONE_MODEL_NOT_FOUND");
          }

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
            unitPriceBefore:
              item.unitPriceBefore != null &&
              Math.abs(item.unitPriceBefore - item.unitPrice) > 0.001
                ? item.unitPriceBefore
                : null,
            retailPrice,
            barcode,
            warrantyMonths: item.warrantyMonths ?? 12,
            taxStatus: parseTaxStatus(item.taxStatus),
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
            } else {
              if (category.brands.length > 0) throw new Error("ITEM_BRAND_REQUIRED");
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

          productId = product.id;
          description = buildAccessoryPurchaseDescription(
            productName,
            categoryName || undefined,
            brandName || undefined
          );

          const accessoryBarcode = product.barcode;

          resolvedItems.push({
            productId,
            description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitPriceBefore:
              item.unitPriceBefore != null &&
              Math.abs(item.unitPriceBefore - item.unitPrice) > 0.001
                ? item.unitPriceBefore
                : null,
            retailPrice,
            barcode: accessoryBarcode,
            warrantyMonths: 12,
            taxStatus: "zero",
            deviceCondition,
            boxCondition: null,
            batteryPercent: null,
            itemNotes: item.itemNotes?.trim() || null,
            imeis: [],
            minQuantity: item.minQuantity ?? 5,
          });
          continue;
        }

        if (!description) {
          throw new Error("DESCRIPTION_REQUIRED");
        }

        const fallbackBarcode = await ensureUniqueBarcode(
          tx,
          auth.companyId,
          item.barcode,
          description
        );

        resolvedItems.push({
          productId,
          description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitPriceBefore:
            item.unitPriceBefore != null &&
            Math.abs(item.unitPriceBefore - item.unitPrice) > 0.001
              ? item.unitPriceBefore
              : null,
          retailPrice,
          barcode: fallbackBarcode,
          warrantyMonths: item.warrantyMonths ?? 12,
          taxStatus: item.taxStatus || "zero",
          deviceCondition,
          boxCondition: deviceCondition === "used" ? item.boxCondition || null : null,
          batteryPercent: deviceCondition === "used" ? item.batteryPercent ?? null : null,
          itemNotes: item.itemNotes?.trim() || null,
          imeis: [],
          minQuantity: null,
        });
      }

      const finalInvoiceNumber = await allocatePurchaseInvoiceNumber(
        tx,
        auth.branchId,
        invoiceNumber
      );

      const p = await tx.purchase.create({
        data: {
          branchId: auth.branchId,
          supplierId: resolvedSupplierId,
          invoiceNumber: finalInvoiceNumber,
          purchaseDate: documentRecordedAt(),
          dueDate: dueDate ? new Date(dueDate) : null,
          status,
          subtotal,
          discount,
          taxRate: effectiveTaxRate,
          taxAmount,
          total,
          paymentType: paymentValidation.paymentType,
          paidAmount,
          invoiceCashPaid:
            paymentValidation.cashSource === "shift" && paidAmount > 0 ? paidAmount : 0,
          cashSource: paymentValidation.cashSource,
          notes,
          createdByUserId: auth.userId,
          items: {
            create: resolvedItems.map((row) => ({
              ...(row.productId
                ? { product: { connect: { id: row.productId } } }
                : {}),
              description: row.description,
              quantity: row.quantity,
              unitPrice: row.unitPrice,
              retailPrice: row.retailPrice,
              total: row.quantity * row.unitPrice,
              barcode: row.barcode,
              warrantyMonths: row.warrantyMonths,
              taxStatus: row.taxStatus,
              deviceCondition: row.deviceCondition,
              boxCondition: row.boxCondition,
              batteryPercent: row.batteryPercent,
              itemNotes: row.itemNotes,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      const matchedPurchaseLines = matchPurchaseLinesToResolved(resolvedItems, p.items);

      for (let i = 0; i < matchedPurchaseLines.length; i++) {
        await setUnitPriceBefore(tx, matchedPurchaseLines[i].id, resolvedItems[i]?.unitPriceBefore ?? null);
        const imeis = resolvedItems[i]?.imeis ?? [];
        if (imeis.length > 0) {
          await setImeisSnapshot(tx, matchedPurchaseLines[i].id, imeis);
        }
      }

      if (status === "completed") {
        for (let i = 0; i < resolvedItems.length; i++) {
          const item = resolvedItems[i];
          const purchaseLine = matchedPurchaseLines[i];
          if (!item?.productId || !purchaseLine) continue;

          const isPhoneLine = item.imeis.length > 0;

          const existingInv = await tx.branchInventory.findUnique({
            where: {
              branchId_productId: {
                branchId: auth.branchId,
                productId: item.productId,
              },
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
              branchId_productId: {
                branchId: auth.branchId,
                productId: item.productId,
              },
            },
            update: {
              quantity: { increment: item.quantity },
              ...(!isPhoneLine ? { purchasePrice } : {}),
              retailPrice: item.retailPrice,
              ...(item.minQuantity != null ? { minQuantity: item.minQuantity } : {}),
            },
            create: {
              branchId: auth.branchId,
              productId: item.productId,
              quantity: item.quantity,
              purchasePrice: item.unitPrice,
              retailPrice: item.retailPrice,
              minQuantity: item.minQuantity ?? 5,
            },
          });

          if (item.imeis.length > 0) {
            const lineUnitCost = Math.round(item.unitPrice * 100) / 100;
            const lineBarcode = purchaseLine.barcode?.trim() || item.barcode?.trim() || null;
            await createPhoneDeviceSerial(tx, {
              branchId: auth.branchId,
              productId: item.productId!,
              purchaseItemId: purchaseLine.id,
              imeis: item.imeis,
              unitCost: lineUnitCost,
              retailPrice: item.retailPrice,
              barcode: lineBarcode,
            });
          }
        }
      }

      if (status === "completed") {
        await applyPurchasePaymentSideEffects(tx, {
          companyId: auth.companyId,
          branchId: auth.branchId,
          userId: auth.userId,
          purchaseId: p.id,
          invoiceNumber: p.invoiceNumber,
          supplierId: resolvedSupplierId,
          supplierName: p.supplier.nameAr,
          purchaseDate: p.purchaseDate,
          paidAmount,
          creditAmount,
          cashSource: paymentValidation.cashSource,
        });
      }

      return p;
    }, { maxWait: 10_000, timeout: 60_000 });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    console.error("Purchase error:", error);
    let message = "حدث خطأ";
    let status = 500;
    if (error instanceof Error) {
      if (error.message === "COLOR_REQUIRED") {
        message = "اختر اللون للموبايل";
        status = 400;
      } else if (error.message === "STORAGE_REQUIRED") {
        message = "اختر المساحة للموبايل";
        status = 400;
      } else if (error.message === "RAM_REQUIRED") {
        message = "اختر الرام للموبايل";
        status = 400;
      } else if (error.message === "BOX_CONDITION_REQUIRED") {
        message = "اختر حالة الكارتونة للمستعمل";
        status = 400;
      } else if (error.message === "BATTERY_REQUIRED") {
        message = "أدخل نسبة البطارية — iPhone مستعمل";
        status = 400;
      } else if (error.message === "PHONE_MODEL_NOT_FOUND") {
        message = "الموديل غير موجود";
        status = 400;
      } else if (error.message === "IMEI_REQUIRED") {
        message = "أدخل IMEI واحد على الأقل";
        status = 400;
      } else if (error.message === "PURCHASE_LINE_MATCH_FAILED") {
        message = "تعذر ربط بنود الفاتورة — حدّث الصفحة وحاول مرة أخرى";
        status = 400;
      } else if (error.message === "SERIAL_PRODUCT_MISMATCH") {
        message = "تعارض بين الصنف وبند الفاتورة";
        status = 400;
      } else if (error.message === "INVOICE_NUMBER_ALLOCATE_FAILED") {
        message = "تعذر تخصيص رقم فاتورة — حدّث الصفحة";
        status = 400;
      } else if (error.message === "ITEM_CATEGORY_NOT_FOUND") {
        message = "تصنيف الصنف غير موجود";
        status = 400;
      } else if (error.message === "ITEM_BRAND_NOT_FOUND") {
        message = "العلامة التجارية غير موجودة";
        status = 400;
      } else if (error.message === "ITEM_BRAND_REQUIRED") {
        message = "اختر العلامة التجارية";
        status = 400;
      } else if (error.message === "ITEM_NAME_REQUIRED") {
        message = "اختر اسم الصنف من القائمة";
        status = 400;
      } else if (error.message === "ITEM_NAME_NOT_FOUND") {
        message = "اسم الصنف غير موجود في القائمة";
        status = 400;
      } else if (error.message === "ACCESSORY_NAME_REQUIRED") {
        message = "أدخل أو اختر اسم الصنف";
        status = 400;
      } else if (error.message === "INSUFFICIENT_VAULT_BALANCE") {
        message = "رصيد خزنة الفرع غير كافٍ";
        status = 400;
      } else if (error.message.startsWith("IMEI_DUPLICATE:")) {
        message = `IMEI مسجل مسبقاً: ${error.message.split(":")[1]}`;
        status = 400;
      } else if (error.message.startsWith("IMEI_INVALID:")) {
        message = `IMEI غير صالح (8–20 رقم): ${error.message.split(":")[1]}`;
        status = 400;
      }
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      message = "رقم الفاتورة مكرر — حدّث الصفحة";
      status = 400;
    }
    return NextResponse.json({ message }, { status });
  }
}
