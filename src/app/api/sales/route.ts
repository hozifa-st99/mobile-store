import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveSaleUnitCost, markDeviceSerialSold, markDeviceSerialSoldIfExists, resolveProductIdFromDevice } from "@/lib/phone-serial-cost";
import {
  countAvailablePhoneSerials,
  findDeviceSerialByIdentifiers,
  markDeviceSerialSoldById,
} from "@/lib/product-serial-service";
import { formatDeviceImeisSnapshot, getDeviceImeis } from "@/lib/product-serial-imeis";
import { readSaleReturnStatus } from "@/lib/sale-item-return-fields";
import { allocateSaleInvoiceNumber } from "@/lib/sale-invoice-number-server";
import { resolveCustomerIdForSale } from "@/lib/sale-customer";
import { compareNewestDocumentFirst } from "@/lib/document-list-sort";
import { documentRecordedAt } from "@/lib/document-datetime";
import { attachInvoiceCreators, listDistinctInvoiceCreators } from "@/lib/invoice-creator-server";

/** فاتورة كبيرة = استعلامات متتالية على Vercel؛ الافتراضي 5 ثواني قصير جداً */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
  const invoiceNumber = searchParams.get("invoiceNumber")?.trim();
  const customerId = searchParams.get("customerId")?.trim();
  const createdByUserId = searchParams.get("createdByUserId")?.trim();
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const returnableOnly = searchParams.get("returnableOnly") === "true";

  const where: {
    branchId: string;
    invoiceNumber?: { contains: string };
    customerId?: string;
    createdByUserId?: string;
    saleDate?: { gte?: Date; lte?: Date };
    status?: string;
  } = { branchId: auth.branchId };

  if (returnableOnly) {
    where.status = "completed";
  }

  if (invoiceNumber) {
    where.invoiceNumber = { contains: invoiceNumber };
  }
  if (customerId) {
    where.customerId = customerId;
  }
  if (createdByUserId) {
    where.createdByUserId = createdByUserId;
  }
  if (dateFrom || dateTo) {
    where.saleDate = {};
    if (dateFrom) where.saleDate.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.saleDate.lte = end;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { customer: true },
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
  });

  sales.sort((a, b) =>
    compareNewestDocumentFirst(a.saleDate, a.createdAt, b.saleDate, b.createdAt)
  );

  const returnStatusMap = await readSaleReturnStatus(
    prisma,
    sales.map((s) => s.id)
  );

  const salesWithCreators = await attachInvoiceCreators(prisma, sales);

  const enriched = salesWithCreators.map((s) => ({
    ...s,
    returnStatus: returnStatusMap[s.id] ?? "none",
  }));

  const filtered = returnableOnly
    ? enriched.filter((s) => s.returnStatus !== "full")
    : enriched;

  const invoiceCreators = await listDistinctInvoiceCreators(prisma, auth.branchId, "sale");

  return NextResponse.json({
    sales: filtered.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      saleDate: s.saleDate,
      status: s.status,
      returnStatus: s.returnStatus,
      total: s.total,
      paymentMethod: s.paymentMethod,
      customer: s.customer ? { nameAr: s.customer.nameAr } : null,
      createdBy: s.createdBy,
    })),
    invoiceCreators,
  });
  } catch (err) {
    console.error("GET /api/sales failed:", err);
    return NextResponse.json(
      { message: "تعذر تحميل فواتير المبيعات", sales: [], invoiceCreators: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const {
      customerId: rawCustomerId,
      customerName,
      customerPhone,
      paymentMethod = "cash",
      discount: rawDiscount = 0,
      taxRate: rawTaxRate = 14,
      taxEnabled = true,
      notes,
      items = [],
      paidAmount,
      branchEmployeeId,
    } = body;

    if (!items.length) {
      return NextResponse.json({ message: "أضف أصناف للفاتورة" }, { status: 400 });
    }

    if (!branchEmployeeId?.trim()) {
      return NextResponse.json({ message: "اختر الموظف الذي كان مع الزبون" }, { status: 400 });
    }

    const discount = Math.max(0, Number(rawDiscount) || 0);
    const taxRate = taxEnabled ? Math.max(0, Number(rawTaxRate) || 0) : 0;

    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );
    const taxAmount = taxRate > 0 ? Math.max(0, ((subtotal - discount) * taxRate) / 100) : 0;
    const total = subtotal - discount + taxAmount;
    const paid = paidAmount ?? total;

    const sale = await prisma.$transaction(async (tx) => {
      const branchEmployee = await tx.branchEmployee.findFirst({
        where: {
          id: branchEmployeeId.trim(),
          branchId: auth.branchId,
          isActive: true,
        },
      });
      if (!branchEmployee) {
        throw new Error("EMPLOYEE_NOT_FOUND");
      }

      const resolvedCustomerId = await resolveCustomerIdForSale(tx, auth.companyId, {
        customerId: rawCustomerId,
        customerName,
        customerPhone,
      });

      const invNum = await allocateSaleInvoiceNumber(tx, auth.branchId);
      const resolvedItems: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        imei?: string;
        scannedImei?: string;
        barcode?: string;
        serialId?: string;
      }[] = [];

      for (const item of items as {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        imei?: string;
        scannedImei?: string;
        barcode?: string;
      }[]) {
        let productId = item.productId;
        const scannedImei = item.scannedImei?.trim() || undefined;
        const deviceIds = {
          imei: scannedImei,
          barcode: item.barcode?.trim() || undefined,
        };

        if (!productId && (deviceIds.imei || deviceIds.barcode)) {
          const fromDevice = await resolveProductIdFromDevice(tx, auth.branchId, deviceIds);
          if (fromDevice) productId = fromDevice;
        }

        let unitCost = 0;
        let storedImei: string | undefined;
        let serialId: string | undefined;

        if (productId) {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { type: true },
          });
          const isPhone = product?.type === "phone";

          if (isPhone) {
            if (item.quantity !== 1) throw new Error("PHONE_QTY_MUST_BE_ONE");
            if (!deviceIds.imei && !deviceIds.barcode) {
              throw new Error("PHONE_DEVICE_ID_REQUIRED");
            }

            const serial = await findDeviceSerialByIdentifiers(tx, auth.branchId, deviceIds, {
              productId,
              status: "available",
            });
            if (serial) {
              const snapshot = formatDeviceImeisSnapshot(getDeviceImeis(serial));
              if (snapshot) storedImei = snapshot;
              serialId = serial.id;
            }
          } else if (item.imei?.trim()) {
            storedImei = item.imei.trim();
          }

          const inv = await tx.branchInventory.findUnique({
            where: {
              branchId_productId: {
                branchId: auth.branchId,
                productId,
              },
            },
          });
          if (!inv || inv.quantity < item.quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }
          if (isPhone) {
            const availableSerials = await countAvailablePhoneSerials(
              tx,
              auth.branchId,
              productId
            );
            if (availableSerials < item.quantity) {
              throw new Error("INSUFFICIENT_STOCK");
            }
          }
          unitCost = isPhone
            ? await resolveSaleUnitCost(
                tx,
                auth.branchId,
                productId,
                deviceIds,
                inv.purchasePrice
              )
            : Math.round((inv.purchasePrice || 0) * 100) / 100;
        }
        resolvedItems.push({
          ...item,
          productId,
          unitCost,
          imei: storedImei,
          scannedImei: deviceIds.imei,
          serialId,
        });
      }

      const s = await tx.sale.create({
        data: {
          branchId: auth.branchId,
          customerId: resolvedCustomerId,
          invoiceNumber: invNum,
          saleDate: documentRecordedAt(),
          status: "completed",
          paymentMethod,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          paidAmount: paid,
          notes,
          branchEmployeeId: branchEmployee.id,
          servedByName: branchEmployee.nameAr,
          createdByUserId: auth.userId,
          items: {
            create: resolvedItems.map((item) => ({
              ...(item.productId
                ? { product: { connect: { id: item.productId } } }
                : {}),
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              total: item.quantity * item.unitPrice,
              ...(item.imei ? { imei: item.imei } : {}),
              ...(item.scannedImei ? { scannedImei: item.scannedImei } : {}),
              ...(item.barcode ? { barcode: item.barcode } : {}),
              ...(item.serialId ? { serial: { connect: { id: item.serialId } } } : {}),
            })),
          },
        },
        include: { items: true, customer: true },
      });

      for (const item of resolvedItems) {
        if (!item.productId) continue;

        await tx.branchInventory.update({
          where: {
            branchId_productId: {
              branchId: auth.branchId,
              productId: item.productId,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { type: true },
        });

        if (product?.type === "phone") {
          if (item.serialId) {
            await markDeviceSerialSoldById(tx, item.serialId);
          } else {
            await markDeviceSerialSold(tx, auth.branchId, item.productId, {
              imei: item.scannedImei,
              barcode: item.barcode,
            });
          }
        } else if (item.imei || item.barcode) {
          await markDeviceSerialSoldIfExists(tx, auth.branchId, item.productId, {
            imei: item.imei,
            barcode: item.barcode,
          });
        }
      }

      return s;
    }, { maxWait: 10_000, timeout: 60_000 });

    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json({ message: "الكمية غير متوفرة في المخزون" }, { status: 400 });
      }
      if (error.message === "PHONE_QTY_MUST_BE_ONE") {
        return NextResponse.json({ message: "كمية الموبايل يجب أن تكون 1" }, { status: 400 });
      }
      if (error.message === "PHONE_DEVICE_ID_REQUIRED") {
        return NextResponse.json(
          { message: "يجب مسح IMEI أو الباركود لبيع الموبايل" },
          { status: 400 }
        );
      }
      if (error.message === "PHONE_SERIAL_NOT_FOUND") {
        return NextResponse.json(
          { message: "الجهاز غير موجود في المخزون أو مباع مسبقاً" },
          { status: 400 }
        );
      }
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json({ message: "العميل غير موجود" }, { status: 400 });
      }
      if (error.message === "EMPLOYEE_NOT_FOUND") {
        return NextResponse.json({ message: "الموظف غير موجود أو غير نشط" }, { status: 400 });
      }
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "رقم الفاتورة مكرر — حدّث الصفحة" }, { status: 400 });
    }
    console.error("Sale error:", error);
    const detail =
      error instanceof Error && process.env.NODE_ENV === "development"
        ? error.message
        : undefined;
    return NextResponse.json(
      { message: detail ? `حدث خطأ: ${detail}` : "حدث خطأ" },
      { status: 500 }
    );
  }
}
