import type { Prisma } from "@prisma/client";
import {
  computeSaleReturnStatus,
  readReturnedQuantitiesBySaleItemIds,
} from "@/lib/sale-item-return-fields";
import { allocateSaleReturnNumber } from "@/lib/sale-return-number-server";
import { createSaleReturnWithItems } from "@/lib/sale-return-db";
import { restoreDeviceSerialAvailable } from "@/lib/phone-serial-cost";
import {
  findDeviceSerialByIdentifiers,
  restoreDeviceSerialAvailableById,
} from "@/lib/product-serial-service";
import { computeSaleReturnPricing } from "@/lib/sale-return-pricing";

type Db = Prisma.TransactionClient;

export interface SaleReturnLineInput {
  saleItemId: string;
  quantity: number;
}

export interface ProcessSaleReturnInput {
  branchId: string;
  saleId: string;
  userId?: string | null;
  notes?: string | null;
  fullReturn?: boolean;
  items?: SaleReturnLineInput[];
}

export async function processSaleReturn(tx: Db, input: ProcessSaleReturnInput) {
  const sale = await tx.sale.findFirst({
    where: { id: input.saleId, branchId: input.branchId },
    include: {
      items: {
        include: { product: { select: { id: true, type: true } } },
      },
    },
  });

  if (!sale) throw new Error("SALE_NOT_FOUND");
  if (sale.status !== "completed") throw new Error("SALE_NOT_COMPLETED");

  const returnedMap = await readReturnedQuantitiesBySaleItemIds(
    tx,
    sale.items.map((i) => i.id)
  );

  const allFullyReturned = sale.items.every((item) => {
    const ret = returnedMap[item.id] ?? 0;
    return ret >= item.quantity;
  });
  if (allFullyReturned) throw new Error("ALREADY_FULLY_RETURNED");

  const itemMap = new Map(sale.items.map((i) => [i.id, i]));

  const lines: {
    saleItemId: string;
    quantity: number;
    productId: string | null;
    description: string;
    unitPrice: number;
    imei: string | null;
    barcode: string | null;
    serialId: string | null;
  }[] = [];

  if (input.fullReturn) {
    for (const item of sale.items) {
      const returned = returnedMap[item.id] ?? 0;
      const returnable = item.quantity - returned;
      if (returnable <= 0) continue;
      lines.push({
        saleItemId: item.id,
        quantity: returnable,
        productId: item.productId,
        description: item.description,
        unitPrice: item.unitPrice,
        imei: item.imei,
        barcode: item.barcode,
        serialId: item.serialId,
      });
    }
  } else {
    for (const row of input.items ?? []) {
      if (!row.quantity || row.quantity <= 0) continue;
      const item = itemMap.get(row.saleItemId);
      if (!item) throw new Error("ITEM_NOT_FOUND");

      const returned = returnedMap[item.id] ?? 0;
      const returnable = item.quantity - returned;
      if (row.quantity > returnable) throw new Error("QUANTITY_EXCEEDS_RETURNABLE");

      lines.push({
        saleItemId: item.id,
        quantity: row.quantity,
        productId: item.productId,
        description: item.description,
        unitPrice: item.unitPrice,
        imei: item.imei,
        barcode: item.barcode,
        serialId: item.serialId,
      });
    }
  }

  if (lines.length === 0) throw new Error("NO_ITEMS_TO_RETURN");

  for (const line of lines) {
    if (!line.productId) throw new Error("ITEM_NO_PRODUCT");
    const item = itemMap.get(line.saleItemId)!;
    const isPhone = item.product?.type === "phone";

    if (isPhone) {
      if (line.quantity !== 1) throw new Error("PHONE_QTY_MUST_BE_ONE");
      if (!line.imei && !line.barcode && !line.serialId) {
        throw new Error("PHONE_DEVICE_ID_REQUIRED");
      }

      if (line.serialId) {
        const serial = await tx.productSerial.findUnique({
          where: { id: line.serialId },
          select: { id: true, productId: true, status: true },
        });
        if (!serial || serial.productId !== line.productId || serial.status !== "sold") {
          throw new Error("PHONE_NOT_SOLD_OR_NOT_FOUND");
        }
      } else {
        const imei = line.imei?.trim();
        if (imei) {
          const soldCount = await tx.productSerialImei.count({
            where: {
              branchId: input.branchId,
              imei,
              serial: { productId: line.productId!, status: "sold" },
            },
          });
          if (soldCount > 1) {
            throw new Error("SALE_RETURN_LEGACY_AMBIGUOUS");
          }
        }

        const serial = await findDeviceSerialByIdentifiers(
          tx,
          input.branchId,
          { imei: line.imei, barcode: line.barcode },
          { productId: line.productId, status: "sold" }
        );
        if (!serial) throw new Error("PHONE_NOT_SOLD_OR_NOT_FOUND");
      }
    }
  }

  const returnLineSubtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const pricing = computeSaleReturnPricing({
    saleSubtotal: sale.subtotal,
    saleDiscount: sale.discount,
    saleTaxRate: sale.taxRate,
    returnLineSubtotal,
  });
  const returnNumber = await allocateSaleReturnNumber(tx, input.branchId);

  const saleReturn = await createSaleReturnWithItems(tx, {
    branchId: input.branchId,
    saleId: sale.id,
    userId: input.userId ?? null,
    returnNumber,
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    taxRate: pricing.taxRate,
    taxAmount: pricing.taxAmount,
    total: pricing.total,
    notes: input.notes?.trim() || null,
    items: lines.map((line) => ({
      saleItemId: line.saleItemId,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: Math.round(line.quantity * line.unitPrice * 100) / 100,
      imei: line.imei,
      barcode: line.barcode,
    })),
  });

  for (const line of lines) {
    if (!line.productId) continue;

    const item = itemMap.get(line.saleItemId)!;
    const isPhone = item.product?.type === "phone";

    await tx.branchInventory.update({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: line.productId,
        },
      },
      data: { quantity: { increment: line.quantity } },
    });

    // الموبaيل: إعادة السيرiال إلزامية. الإكسssoار: كمية فقط — السيرiال اختياري (serialId فقط)
    if (line.serialId) {
      await restoreDeviceSerialAvailableById(tx, line.serialId);
    } else if (isPhone && (line.imei || line.barcode)) {
      await restoreDeviceSerialAvailable(tx, input.branchId, line.productId, {
        imei: line.imei,
        barcode: line.barcode,
      });
    }
  }

  const statusItems = sale.items.map((item) => {
    const before = returnedMap[item.id] ?? 0;
    const line = lines.find((l) => l.saleItemId === item.id);
    const added = line?.quantity ?? 0;
    return { quantity: item.quantity, returnedQuantity: before + added };
  });

  const newStatus = computeSaleReturnStatus(statusItems);

  return {
    saleReturn,
    returnStatus: newStatus,
  };
}
