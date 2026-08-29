import type { Prisma } from "@prisma/client";
import {
  computePurchaseReturnStatus,
  readPurchaseItemReturnFields,
} from "@/lib/purchase-item-return-fields";
import { readUnitPriceBeforeByItemIds } from "@/lib/purchase-item-price-before";
import { splitExpenseNotes } from "@/lib/purchase-invoice-notes";
import {
  allocateOrphanedExpenseToRemaining,
  computeExpenseHandlingSplit,
  resolveLineReturnPricing,
  type PurchaseReturnExpenseHandling,
} from "@/lib/purchase-return-expense";
import { allocatePurchaseReturnNumber } from "@/lib/purchase-return-number-server";
import { createExpenseDocumentInTransaction } from "@/lib/expense-service";
import { createPurchaseReturnWithItems } from "@/lib/purchase-return-db";
import {
  readPerUnitIncreaseByItemIds,
  recordPurchaseItemCostAdjustments,
} from "@/lib/purchase-item-cost-adjustments";
import {
  formatImeisSnapshot,
  parseImeisSnapshot,
} from "@/lib/purchase-return-number";
import { getDeviceImeis } from "@/lib/product-serial-imeis";
import {
  deleteDeviceSerialById,
  findDeviceSerialByPurchaseItemId,
} from "@/lib/product-serial-service";
import { recordPurchaseReturnCreditReduction } from "@/lib/purchase-payment-service";
import {
  applyPurchaseReturnSettlement,
  computePurchaseReturnGoodsCashSettleable,
  validatePurchaseReturnSettlement,
} from "@/lib/purchase-return-settlement";
import { computeWeightedAverageAfterPurchaseReturn } from "@/lib/weighted-average-cost";

type Db = Prisma.TransactionClient;

export interface ReturnLineInput {
  purchaseItemId: string;
  quantity: number;
}

export interface ProcessReturnInput {
  branchId: string;
  purchaseId: string;
  userId?: string | null;
  notes?: string | null;
  fullReturn?: boolean;
  items?: ReturnLineInput[];
  expenseHandling?: PurchaseReturnExpenseHandling;
  expenseRecoveredAmount?: number;
  shiftDepositAmount?: number;
  receivableAmount?: number;
}

async function validatePhonePurchaseLineSerial(
  tx: Db,
  branchId: string,
  purchaseItemId: string,
  productId: string,
  imeis: string[]
): Promise<string | null> {
  if (imeis.length === 0) {
    return "لا يوجد سجل IMEI لهذا السطر — لا يمكن إرجاع الموبايل";
  }

  const serial = await findDeviceSerialByPurchaseItemId(tx, branchId, purchaseItemId, {
    productId,
  });
  if (!serial) {
    return "لا يوجد سجل جهاز مربوط ببند هذه الفاتورة";
  }

  const serialImeis = getDeviceImeis(serial);
  for (const imei of imeis) {
    if (!serialImeis.includes(imei)) {
      return `IMEI غير مطابق لبند الفاتورة: ${imei}`;
    }
  }

  if (serial.status === "sold") {
    return "لا يمكن الإرجاع — الجهاز مباع";
  }
  if (serial.status !== "available") {
    return "الجهاز غير متاح للإرجاع في المخزون";
  }

  return null;
}

async function createReturnDailyExpense(
  tx: Db,
  branchId: string,
  purchaseReturnId: string,
  returnNumber: string,
  invoiceNumber: string,
  purchaseNotes: string | null,
  amount: number
): Promise<void> {
  if (amount <= 0.001) return;
  const { expenseLine } = splitExpenseNotes(purchaseNotes);
  const description = `من مصاريف فاتورة مشتريات ${invoiceNumber}`;
  const rounded = Math.round(amount * 100) / 100;

  await createExpenseDocumentInTransaction(tx, branchId, {
    paymentMethod: "cash",
    notes: expenseLine || `مرتجع ${returnNumber}`,
    purchaseReturnId,
    lines: [
      {
        category: "مصاريف مشتريات",
        description,
        amount: rounded,
      },
    ],
  });
}

async function redistributeExpenseToRemaining(
  tx: Db,
  branchId: string,
  purchaseReturnId: string,
  amount: number,
  remainingAfterReturn: {
    purchaseItemId: string;
    productId: string;
    productType: string | null;
    remainingQty: number;
    unitPriceBefore: number;
    currentUnitPriceAfter: number;
  }[],
  returnedLayers: { productId: string; quantity: number; unitCost: number }[]
): Promise<void> {
  if (amount <= 0.001 || remainingAfterReturn.length === 0) return;

  const allocMap = allocateOrphanedExpenseToRemaining(
    amount,
    remainingAfterReturn.map((r) => ({
      purchaseItemId: r.purchaseItemId,
      productId: r.productId,
      remainingQty: r.remainingQty,
      unitPriceBefore: r.unitPriceBefore,
      currentUnitPriceAfter: r.currentUnitPriceAfter,
    }))
  );

  const adjustments: { purchaseItemId: string; perUnitIncrease: number }[] = [];
  const extraByProduct = new Map<string, number>();

  for (const row of remainingAfterReturn) {
    const extra = allocMap.get(row.purchaseItemId) ?? 0;
    if (extra <= 0) continue;
    const perUnit = extra / row.remainingQty;
    adjustments.push({ purchaseItemId: row.purchaseItemId, perUnitIncrease: perUnit });
    extraByProduct.set(row.productId, (extraByProduct.get(row.productId) ?? 0) + extra);
  }

  await recordPurchaseItemCostAdjustments(tx, purchaseReturnId, adjustments);

  const returnedByProduct = new Map<string, { quantity: number; value: number }>();
  for (const layer of returnedLayers) {
    const prev = returnedByProduct.get(layer.productId) ?? { quantity: 0, value: 0 };
    returnedByProduct.set(layer.productId, {
      quantity: prev.quantity + layer.quantity,
      value: prev.value + layer.quantity * layer.unitCost,
    });
  }

  const accessoryProductIds = new Set(
    remainingAfterReturn
      .filter((row) => row.productType !== "phone")
      .map((row) => row.productId)
  );

  for (const [productId, extra] of extraByProduct) {
    if (!accessoryProductIds.has(productId)) continue;

    const inventory = await tx.branchInventory.findUnique({
      where: {
        branchId_productId: {
          branchId,
          productId,
        },
      },
      select: { quantity: true, purchasePrice: true },
    });
    if (!inventory || inventory.quantity <= 0) continue;

    const returned = returnedByProduct.get(productId) ?? { quantity: 0, value: 0 };
    const returnedUnitCost =
      returned.quantity > 0 ? returned.value / returned.quantity : 0;
    const purchasePrice = computeWeightedAverageAfterPurchaseReturn({
      quantityBeforeReturn: inventory.quantity + returned.quantity,
      currentAverageCost: inventory.purchasePrice,
      returnedQuantity: returned.quantity,
      returnedUnitCost,
      redistributedExpense: extra,
    });

    await tx.branchInventory.update({
      where: {
        branchId_productId: {
          branchId,
          productId,
        },
      },
      data: { purchasePrice },
    });
  }
}

export async function processPurchaseReturn(tx: Db, input: ProcessReturnInput) {
  const purchase = await tx.purchase.findFirst({
    where: { id: input.purchaseId, branchId: input.branchId },
    include: {
      items: {
        include: { product: { select: { id: true, type: true } } },
      },
    },
  });

  if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
  if (purchase.status !== "completed") throw new Error("PURCHASE_NOT_COMPLETED");

  const returnFields = await readPurchaseItemReturnFields(
    tx,
    purchase.items.map((i) => i.id)
  );

  const allFullyReturned = purchase.items.every((item) => {
    const ret = returnFields[item.id]?.returnedQuantity ?? 0;
    return ret >= item.quantity;
  });
  if (allFullyReturned) throw new Error("ALREADY_FULLY_RETURNED");

  const priceBeforeMap = await readUnitPriceBeforeByItemIds(
    tx,
    purchase.items.map((i) => i.id)
  );
  const { expenseLine } = splitExpenseNotes(purchase.notes);
  const pricingItems = purchase.items.map((i) => ({
    id: i.id,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

  const itemMap = new Map(purchase.items.map((i) => [i.id, i]));

  const lines: {
    purchaseItemId: string;
    quantity: number;
    productId: string | null;
    description: string;
    refundUnitPrice: number;
    expenseShare: number;
    imeis: string[];
  }[] = [];

  if (input.fullReturn) {
    for (const item of purchase.items) {
      const fields = returnFields[item.id] ?? { returnedQuantity: 0, imeisSnapshot: null };
      const returnable = item.quantity - fields.returnedQuantity;
      if (returnable <= 0) continue;
      const imeis = parseImeisSnapshot(fields.imeisSnapshot);
      const pricing = resolveLineReturnPricing(
        { id: item.id, quantity: item.quantity, unitPrice: item.unitPrice },
        pricingItems,
        priceBeforeMap[item.id] ?? null,
        expenseLine,
        returnable
      );
      lines.push({
        purchaseItemId: item.id,
        quantity: returnable,
        productId: item.productId,
        description: item.description,
        refundUnitPrice: pricing.refundUnitPrice,
        expenseShare: pricing.expenseShare,
        imeis,
      });
    }
  } else {
    for (const row of input.items ?? []) {
      if (!row.quantity || row.quantity <= 0) continue;
      const item = itemMap.get(row.purchaseItemId);
      if (!item) throw new Error("ITEM_NOT_FOUND");

      const fields = returnFields[item.id] ?? { returnedQuantity: 0, imeisSnapshot: null };
      const returnable = item.quantity - fields.returnedQuantity;
      if (row.quantity > returnable) throw new Error("QUANTITY_EXCEEDS_RETURNABLE");

      const imeis = parseImeisSnapshot(fields.imeisSnapshot);
      const pricing = resolveLineReturnPricing(
        { id: item.id, quantity: item.quantity, unitPrice: item.unitPrice },
        pricingItems,
        priceBeforeMap[item.id] ?? null,
        expenseLine,
        row.quantity
      );
      lines.push({
        purchaseItemId: item.id,
        quantity: row.quantity,
        productId: item.productId,
        description: item.description,
        refundUnitPrice: pricing.refundUnitPrice,
        expenseShare: pricing.expenseShare,
        imeis,
      });
    }
  }

  if (lines.length === 0) throw new Error("NO_ITEMS_TO_RETURN");

  for (const line of lines) {
    if (!line.productId) throw new Error("ITEM_NO_PRODUCT");
    const item = itemMap.get(line.purchaseItemId)!;
    const isPhone = item.product?.type === "phone";

    if (isPhone) {
      if (line.quantity !== 1) throw new Error("PHONE_QTY_MUST_BE_ONE");
      const err = await validatePhonePurchaseLineSerial(
        tx,
        input.branchId,
        line.purchaseItemId,
        line.productId,
        line.imeis
      );
      if (err) throw new Error(err);
    }

    const inv = await tx.branchInventory.findUnique({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: line.productId,
        },
      },
      select: { quantity: true },
    });
    if (!inv || inv.quantity < line.quantity) {
      throw new Error("INSUFFICIENT_INVENTORY");
    }
  }

  const totalExpenseShare = lines.reduce((s, l) => s + l.expenseShare, 0);
  const hasExpenseOnReturn = totalExpenseShare > 0.001;

  let expenseHandling: PurchaseReturnExpenseHandling | null = null;
  let expenseRecoveredAmount = 0;
  if (hasExpenseOnReturn) {
    expenseHandling = input.expenseHandling ?? null;
    if (!expenseHandling) throw new Error("EXPENSE_HANDLING_REQUIRED");
    if (expenseHandling === "partial_recovery") {
      if (input.expenseRecoveredAmount == null || Number.isNaN(input.expenseRecoveredAmount)) {
        throw new Error("EXPENSE_RECOVERED_REQUIRED");
      }
      expenseRecoveredAmount = Math.max(0, Number(input.expenseRecoveredAmount));
      if (expenseRecoveredAmount > totalExpenseShare + 0.001) {
        throw new Error("EXPENSE_RECOVERED_EXCEEDS");
      }
    }
  }

  const remainingProductIds = purchase.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const priorPerUnitIncrease = await readPerUnitIncreaseByItemIds(
    tx,
    purchase.items.map((i) => i.id)
  );

  const remainingAfterReturn = purchase.items
    .map((item) => {
      const ret = returnFields[item.id]?.returnedQuantity ?? 0;
      const returning = lines.find((l) => l.purchaseItemId === item.id)?.quantity ?? 0;
      const remainingQty = item.quantity - ret - returning;
      const linePricing = resolveLineReturnPricing(
        { id: item.id, quantity: item.quantity, unitPrice: item.unitPrice },
        pricingItems,
        priceBeforeMap[item.id] ?? null,
        expenseLine,
        item.quantity
      );
      const priorIncrease = priorPerUnitIncrease[item.id] ?? 0;
      const currentUnitPriceAfter =
        Math.round((item.unitPrice + priorIncrease) * 100) / 100;
      return {
        purchaseItemId: item.id,
        productId: item.productId,
        productType: item.product?.type ?? null,
        remainingQty,
        unitPriceBefore: linePricing.unitPriceBefore,
        currentUnitPriceAfter,
      };
    })
    .filter((r) => r.remainingQty > 0 && r.productId);

  const layerCostByItemId = new Map(
    purchase.items.map((item) => {
      const priorIncrease = priorPerUnitIncrease[item.id] ?? 0;
      return [
        item.id,
        Math.round((item.unitPrice + priorIncrease) * 100) / 100,
      ] as const;
    })
  );
  const returnedLayers = lines
    .filter((line) => line.productId)
    .map((line) => ({
      productId: line.productId!,
      quantity: line.quantity,
      unitCost: layerCostByItemId.get(line.purchaseItemId) ?? 0,
    }));

  const hasRemainingItems = remainingAfterReturn.length > 0;

  const expenseSplit = hasExpenseOnReturn
    ? computeExpenseHandlingSplit({
        handling: expenseHandling!,
        totalOrphaned: totalExpenseShare,
        recoveredAmount: expenseRecoveredAmount,
        hasRemainingItems,
      })
    : { recovered: 0, toRedistribute: 0, toDailyExpense: 0 };

  if (
    hasExpenseOnReturn &&
    expenseHandling === "redistribute" &&
    !hasRemainingItems
  ) {
    throw new Error("NO_REMAINING_FOR_REDISTRIBUTE");
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.refundUnitPrice, 0);
  const returnTotal = Math.round((subtotal + expenseSplit.recovered) * 100) / 100;
  const returnNumber = await allocatePurchaseReturnNumber(tx, input.branchId);

  const purchaseReturn = await createPurchaseReturnWithItems(tx, {
    branchId: input.branchId,
    purchaseId: purchase.id,
    userId: input.userId ?? null,
    returnNumber,
    subtotal,
    total: returnTotal,
    notes: input.notes?.trim() || null,
    expenseHandling: hasExpenseOnReturn ? expenseHandling : null,
    expenseAmount: hasExpenseOnReturn ? totalExpenseShare : 0,
    expenseRecoveredAmount: expenseSplit.recovered,
    items: lines.map((line) => ({
      purchaseItemId: line.purchaseItemId,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.refundUnitPrice,
      total: line.quantity * line.refundUnitPrice,
      imeisSnapshot: formatImeisSnapshot(line.imeis),
    })),
  });

  for (const line of lines) {
    await tx.branchInventory.update({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: line.productId!,
        },
      },
      data: { quantity: { decrement: line.quantity } },
    });

    if (line.imeis.length > 0) {
      const serial = await findDeviceSerialByPurchaseItemId(
        tx,
        input.branchId,
        line.purchaseItemId,
        { productId: line.productId!, status: "available" }
      );
      if (serial) {
        await deleteDeviceSerialById(tx, serial.id);
      }
    }

  }

  if (expenseSplit.toRedistribute > 0.001) {
    await redistributeExpenseToRemaining(
      tx,
      input.branchId,
      purchaseReturn.id,
      expenseSplit.toRedistribute,
      remainingAfterReturn.map((r) => ({
        purchaseItemId: r.purchaseItemId,
        productId: r.productId!,
        productType: r.productType,
        remainingQty: r.remainingQty,
        unitPriceBefore: r.unitPriceBefore,
        currentUnitPriceAfter: r.currentUnitPriceAfter,
      })),
      returnedLayers
    );
  }

  if (expenseSplit.toDailyExpense > 0.001) {
    await createReturnDailyExpense(
      tx,
      input.branchId,
      purchaseReturn.id,
      returnNumber,
      purchase.invoiceNumber,
      purchase.notes,
      expenseSplit.toDailyExpense
    );
  }

  const statusItems = purchase.items.map((item) => {
    const before = returnFields[item.id]?.returnedQuantity ?? 0;
    const line = lines.find((l) => l.purchaseItemId === item.id);
    const added = line?.quantity ?? 0;
    return { quantity: item.quantity, returnedQuantity: before + added };
  });

  const newStatus = computePurchaseReturnStatus(statusItems);

  const returnRecordedAt = new Date();
  const creditReductionAmount = await recordPurchaseReturnCreditReduction(tx, {
    branchId: input.branchId,
    purchaseId: purchase.id,
    paymentType: purchase.paymentType,
    userId: input.userId ?? null,
    returnNumber,
    returnTotal,
    returnDate: returnRecordedAt,
    notes: input.notes?.trim() || null,
  });

  const cashSettleable = computePurchaseReturnGoodsCashSettleable(
    returnTotal,
    creditReductionAmount,
    expenseSplit.recovered
  );
  const settlement = validatePurchaseReturnSettlement(
    cashSettleable,
    input.shiftDepositAmount ?? 0,
    input.receivableAmount ?? 0
  );

  await tx.purchaseReturn.update({
    where: { id: purchaseReturn.id },
    data: {
      creditReductionAmount,
      shiftDepositAmount: settlement.shiftDepositAmount,
      receivableAmount: settlement.receivableAmount,
    },
  });

  if (settlement.receivableAmount > 0.0001) {
    await applyPurchaseReturnSettlement(tx, {
      branchId: input.branchId,
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      purchaseReturnId: purchaseReturn.id,
      returnNumber,
      receivableAmount: settlement.receivableAmount,
      notes: input.notes?.trim() || null,
    });
  }

  return {
    purchaseReturn: {
      ...purchaseReturn,
      creditReductionAmount,
      shiftDepositAmount: settlement.shiftDepositAmount,
      receivableAmount: settlement.receivableAmount,
      cashSettleable,
    },
    returnStatus: newStatus,
    expenseAmount: totalExpenseShare,
    expenseRecoveredAmount: expenseSplit.recovered,
    expenseHandling,
  };
}
