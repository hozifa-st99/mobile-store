import type { Prisma } from "@prisma/client";
import {
  findDeviceSerialByIdentifiers,
  markDeviceSerialSoldById,
  restoreDeviceSerialAvailableById,
} from "@/lib/product-serial-service";

type Db = Prisma.TransactionClient;

export interface DeviceIdentifiers {
  imei?: string | null;
  barcode?: string | null;
}

async function costFromPurchaseLine(
  tx: Db,
  purchaseItemId: string
): Promise<number | null> {
  const line = await tx.purchaseItem.findUnique({
    where: { id: purchaseItemId },
    select: { unitPrice: true },
  });
  return line ? line.unitPrice : null;
}

async function costFromPurchaseItemBarcode(
  tx: Db,
  branchId: string,
  barcode: string,
  productId?: string | null
): Promise<number | null> {
  const line = await tx.purchaseItem.findFirst({
    where: {
      barcode,
      ...(productId ? { productId } : {}),
      purchase: { branchId },
    },
    orderBy: { purchase: { purchaseDate: "desc" } },
    select: { unitPrice: true },
  });
  return line?.unitPrice ?? null;
}

async function costFromImeiSnapshot(
  tx: Db,
  branchId: string,
  imei: string,
  productId?: string | null
): Promise<number | null> {
  const lines = await tx.purchaseItem.findMany({
    where: {
      ...(productId ? { productId } : {}),
      purchase: { branchId },
      imeisSnapshot: { not: null },
    },
    select: { unitPrice: true, imeisSnapshot: true, purchase: { select: { purchaseDate: true } } },
    orderBy: { purchase: { purchaseDate: "desc" } },
    take: 50,
  });

  for (const line of lines) {
    const imeis = (line.imeisSnapshot || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (imeis.includes(imei.trim())) {
      return line.unitPrice;
    }
  }

  return null;
}

/** تكلفة البيع من IMEI أو باركود الجهاز → سطر فاتورة الشراء */
export async function resolveSaleUnitCost(
  tx: Db,
  branchId: string,
  productId: string | null | undefined,
  ids: DeviceIdentifiers,
  inventoryFallback: number
): Promise<number> {
  const imei = ids.imei?.trim();
  const barcode = ids.barcode?.trim();

  const serial = await findDeviceSerialByIdentifiers(tx, branchId, ids, { productId: productId ?? undefined });

  if (serial) {
    if (serial.unitCost > 0.001) {
      return Math.round(serial.unitCost * 100) / 100;
    }
    if (serial.purchaseItemId) {
      const fromLine = await costFromPurchaseLine(tx, serial.purchaseItemId);
      if (fromLine != null) return fromLine;
    }
  }

  if (barcode) {
    const fromBarcode = await costFromPurchaseItemBarcode(tx, branchId, barcode, productId);
    if (fromBarcode != null) return fromBarcode;
  }

  if (imei) {
    const fromSnapshot = await costFromImeiSnapshot(tx, branchId, imei, productId);
    if (fromSnapshot != null) return fromSnapshot;
  }

  return inventoryFallback;
}

/** يحدّد المنتج من IMEI/باركود إذا لم يُرسَل productId */
export async function resolveProductIdFromDevice(
  tx: Db,
  branchId: string,
  ids: DeviceIdentifiers
): Promise<string | null> {
  const serial = await findDeviceSerialByIdentifiers(tx, branchId, ids, {
    status: "available",
  });
  return serial?.productId ?? null;
}

export async function markDeviceSerialSold(
  tx: Db,
  branchId: string,
  productId: string,
  ids: DeviceIdentifiers
): Promise<void> {
  const serial = await findDeviceSerialByIdentifiers(tx, branchId, ids, {
    productId,
    status: "available",
  });
  if (!serial) {
    throw new Error("PHONE_SERIAL_NOT_FOUND");
  }
  await markDeviceSerialSoldById(tx, serial.id);
}

/** للإكسسوارات — يُحدّث السerial إن وُجد بدون رمي خطأ */
export async function markDeviceSerialSoldIfExists(
  tx: Db,
  branchId: string,
  productId: string,
  ids: DeviceIdentifiers
): Promise<void> {
  const serial = await findDeviceSerialByIdentifiers(tx, branchId, ids, {
    productId,
    status: "available",
  });
  if (serial) {
    await markDeviceSerialSoldById(tx, serial.id);
  }
}

/** إعادة الجهاز للمخزون بعد مرتجع مبيعات */
export async function restoreDeviceSerialAvailable(
  tx: Db,
  branchId: string,
  productId: string,
  ids: DeviceIdentifiers
): Promise<void> {
  const serial = await findDeviceSerialByIdentifiers(tx, branchId, ids, {
    productId,
    status: "sold",
  });
  if (!serial) {
    throw new Error("PHONE_SERIAL_NOT_FOUND");
  }
  await restoreDeviceSerialAvailableById(tx, serial.id);
}
