import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import {
  normalizeDeviceImeis,
  validateDeviceImeis,
} from "@/lib/product-serial-imeis";
import { resolveNextCycleIndex } from "@/lib/device-cycle";
type Db = Prisma.TransactionClient | PrismaClient;

const serialWithImeisSelect = {
  id: true,
  branchId: true,
  productId: true,
  purchaseItemId: true,
  stockEntryItemId: true,
  unitCost: true,
  retailPrice: true,
  barcode: true,
  status: true,
  cycleIndex: true,
  imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" as const } },
  purchaseItem: { select: { productId: true, retailPrice: true } },
  stockEntryItem: { select: { productId: true, retailPrice: true } },
} as const;

export type LoadedDeviceSerial = Prisma.ProductSerialGetPayload<{
  select: typeof serialWithImeisSelect;
}>;

export { serialWithImeisSelect };

export { previewImeiCycleEntry, resolveNextCycleIndex } from "@/lib/device-cycle";
export type { ImeiCyclePreview } from "@/lib/device-cycle";

export async function assertBranchImeisAvailable(
  tx: Db,
  branchId: string,
  imeis: string[],
  excludeSerialId?: string
): Promise<void> {
  const normalized = normalizeDeviceImeis(imeis);
  if (normalized.length === 0) {
    throw new Error("IMEI_REQUIRED");
  }
  validateDeviceImeis(normalized);

  for (const imei of normalized) {
    const activeEntry = await tx.productSerialImei.findFirst({
      where: {
        branchId,
        imei,
        serial: { status: "available" },
        ...(excludeSerialId ? { serialId: { not: excludeSerialId } } : {}),
      },
      select: { serialId: true },
    });
    if (activeEntry) {
      throw new Error(`IMEI_DUPLICATE:${imei}`);
    }
  }
}

export async function createPhoneDeviceSerial(
  tx: Db,
  input: {
    branchId: string;
    productId: string;
    imeis: string[];
    unitCost: number;
    retailPrice: number;
    barcode?: string | null;
    purchaseItemId?: string | null;
    stockEntryItemId?: string | null;
  }
): Promise<LoadedDeviceSerial> {
  const imeis = normalizeDeviceImeis(input.imeis);
  await assertBranchImeisAvailable(tx, input.branchId, imeis);

  if (input.purchaseItemId) {
    const line = await tx.purchaseItem.findUnique({
      where: { id: input.purchaseItemId },
      select: { productId: true },
    });
    if (line?.productId && line.productId !== input.productId) {
      throw new Error("SERIAL_PRODUCT_MISMATCH");
    }
  }

  if (input.stockEntryItemId) {
    const line = await tx.stockEntryItem.findUnique({
      where: { id: input.stockEntryItemId },
      select: { productId: true },
    });
    if (line?.productId && line.productId !== input.productId) {
      throw new Error("SERIAL_PRODUCT_MISMATCH");
    }
  }

  const cycleIndex = await resolveNextCycleIndex(tx, input.branchId, imeis);

  return tx.productSerial.create({
    data: {
      branchId: input.branchId,
      productId: input.productId,
      purchaseItemId: input.purchaseItemId ?? null,
      stockEntryItemId: input.stockEntryItemId ?? null,
      unitCost: input.unitCost,
      retailPrice: input.retailPrice,
      barcode: input.barcode?.trim() || null,
      status: "available",
      cycleIndex,
      imeiEntries: {
        create: imeis.map((imei) => ({
          branchId: input.branchId,
          imei,
        })),
      },
    },
    select: serialWithImeisSelect,
  });
}

export async function findDeviceSerialByPurchaseItemId(
  tx: Db,
  branchId: string,
  purchaseItemId: string,
  options?: { productId?: string; status?: string }
): Promise<LoadedDeviceSerial | null> {
  return tx.productSerial.findFirst({
    where: {
      branchId,
      purchaseItemId,
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    select: serialWithImeisSelect,
  });
}

export async function findDeviceSerialByImei(
  tx: Db,
  branchId: string,
  imei: string,
  options?: { productId?: string; status?: string }
): Promise<LoadedDeviceSerial | null> {
  const trimmed = imei.trim();
  if (!trimmed) return null;

  const entries = await tx.productSerialImei.findMany({
    where: { branchId, imei: trimmed },
    select: {
      serial: {
        select: serialWithImeisSelect,
      },
    },
    orderBy: { serial: { cycleIndex: "desc" } },
  });

  for (const entry of entries) {
    const serial = entry.serial;
    if (options?.productId && serial.productId !== options.productId) continue;
    if (options?.status && serial.status !== options.status) continue;
    return serial;
  }

  return null;
}

export async function findDeviceSerialByBarcode(
  tx: Db,
  branchId: string,
  barcode: string,
  options?: { productId?: string; status?: string }
): Promise<LoadedDeviceSerial | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  return tx.productSerial.findFirst({
    where: {
      branchId,
      barcode: trimmed,
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    select: serialWithImeisSelect,
  });
}

export async function findDeviceSerialByIdentifiers(
  tx: Db,
  branchId: string,
  ids: { imei?: string | null; barcode?: string | null },
  options?: { productId?: string; status?: string }
): Promise<LoadedDeviceSerial | null> {
  const imei = ids.imei?.trim();
  const barcode = ids.barcode?.trim();

  const tryImei = async (value: string) => {
    if (imei && barcode) {
      const byImei = await findDeviceSerialByImei(tx, branchId, value, options);
      if (byImei && byImei.barcode === barcode) return byImei;
    }
    return findDeviceSerialByImei(tx, branchId, value, options);
  };

  if (imei) {
    const direct = await tryImei(imei);
    if (direct) return direct;

    for (const part of parseImeisSnapshot(imei)) {
      const found = await tryImei(part);
      if (found) return found;
    }
  }

  if (barcode) {
    return findDeviceSerialByBarcode(tx, branchId, barcode, options);
  }

  return null;
}

export async function markDeviceSerialSoldById(tx: Db, serialId: string): Promise<void> {
  await tx.productSerial.updateMany({
    where: { id: serialId, status: "available" },
    data: { status: "sold" },
  });
}

export async function restoreDeviceSerialAvailableById(tx: Db, serialId: string): Promise<void> {
  const serial = await tx.productSerial.findUnique({
    where: { id: serialId },
    select: serialWithImeisSelect,
  });
  if (!serial || serial.status !== "sold") {
    throw new Error("PHONE_SERIAL_NOT_FOUND");
  }

  const imeis = normalizeDeviceImeis(serial.imeiEntries.map((entry) => entry.imei));
  await assertBranchImeisAvailable(tx, serial.branchId, imeis, serialId);

  await tx.productSerial.updateMany({
    where: { id: serialId, status: "sold" },
    data: { status: "available" },
  });
}

export async function markDeviceSerialRemovedById(tx: Db, serialId: string): Promise<void> {
  await tx.productSerial.updateMany({
    where: { id: serialId, status: "available" },
    data: { status: "removed" },
  });
}

export async function deleteDeviceSerialById(tx: Db, serialId: string): Promise<void> {
  await markDeviceSerialRemovedById(tx, serialId);
}

export async function countAvailablePhoneSerials(
  tx: Db,
  branchId: string,
  productId: string
): Promise<number> {
  const serials = await tx.productSerial.findMany({
    where: { branchId, productId, status: "available" },
    select: serialWithImeisSelect,
  });
  return serials.filter((serial) => serialBelongsToProduct(serial, productId)).length;
}

/** يوحّد branchInventory.quantity مع عدد الأجهزة المتاحة */
export async function syncPhoneInventoryQuantity(
  tx: Db,
  branchId: string,
  productId: string
): Promise<number> {
  const availableCount = await countAvailablePhoneSerials(tx, branchId, productId);
  await tx.branchInventory.updateMany({
    where: { branchId, productId },
    data: { quantity: availableCount },
  });
  return availableCount;
}
