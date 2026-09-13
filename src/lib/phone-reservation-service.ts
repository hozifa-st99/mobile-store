import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  PHONE_RESERVATION_STATUS,
  PHONE_SERIAL_STATUS,
} from "@/lib/phone-serial-status";
import {
  formatDeviceImeisLabel,
  getDeviceImeis,
} from "@/lib/product-serial-imeis";
import {
  findDeviceSerialByBarcode,
  findDeviceSerialByImei,
  serialWithImeisSelect,
  syncPhoneInventoryQuantity,
} from "@/lib/product-serial-service";
import { getSerialEffectiveRetailPrice } from "@/lib/phone-serial-pricing";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";

type Db = Prisma.TransactionClient | typeof prisma;
type DbRoot = typeof prisma;

export class PhoneReservationError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "PhoneReservationError";
  }
}

const reservationInclude = {
  customer: { select: { id: true, nameAr: true, phone: true } },
  serial: {
    select: {
      ...serialWithImeisSelect,
      product: {
        select: {
          id: true,
          nameAr: true,
          brand: true,
          color: true,
          storage: true,
          ram: true,
          deviceCondition: true,
        },
      },
    },
  },
  user: { select: { id: true, fullNameAr: true } },
} satisfies Prisma.PhoneReservationInclude;

export type PhoneReservationRow = Prisma.PhoneReservationGetPayload<{
  include: typeof reservationInclude;
}>;

function mapReservationRow(row: PhoneReservationRow) {
  const imeis = getDeviceImeis(row.serial);
  const inventoryRetail =
    row.serial.product && row.serial.branchId
      ? row.serial.retailPrice
      : row.serial.retailPrice;

  return {
    id: row.id,
    status: row.status,
    notes: row.notes,
    reservedAt: row.reservedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    saleId: row.saleId,
    customer: row.customer,
    reservedBy: row.user
      ? { id: row.user.id, nameAr: row.user.fullNameAr }
      : null,
    serial: {
      id: row.serial.id,
      productId: row.serial.productId,
      barcode: row.serial.barcode,
      status: row.serial.status,
      imeis,
      imeiLabel: imeis.length > 0 ? formatDeviceImeisLabel(imeis) : "—",
      retailPrice: getSerialEffectiveRetailPrice(
        {
          unitCost: row.serial.unitCost,
          retailPrice: row.serial.retailPrice,
          purchaseItemRetailPrice: row.serial.purchaseItem?.retailPrice,
          stockEntryItemRetailPrice: row.serial.stockEntryItem?.retailPrice,
        },
        inventoryRetail
      ),
      product: row.serial.product,
    },
  };
}

export async function listAvailablePhonesForReservation(
  db: Db,
  branchId: string,
  companyId: string,
  search: string
) {
  const q = search.trim();
  const serials = await db.productSerial.findMany({
    where: {
      branchId,
      status: PHONE_SERIAL_STATUS.AVAILABLE,
      product: {
        companyId,
        deletedAt: null,
        isActive: true,
        type: "phone",
        ...(q
          ? {
              OR: [
                { nameAr: { contains: q, mode: "insensitive" as const } },
                { brand: { contains: q, mode: "insensitive" as const } },
                { barcode: { contains: q, mode: "insensitive" as const } },
                {
                  serials: {
                    some: {
                      branchId,
                      OR: [
                        { barcode: { contains: q, mode: "insensitive" as const } },
                        {
                          imeiEntries: {
                            some: { imei: { contains: q, mode: "insensitive" as const } },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      ...serialWithImeisSelect,
      product: {
        select: {
          id: true,
          nameAr: true,
          brand: true,
          color: true,
          storage: true,
          ram: true,
          deviceCondition: true,
        },
      },
    },
    take: 200,
  });

  return serials
    .filter((serial) => serialBelongsToProduct(serial, serial.productId))
    .map((serial) => {
      const imeis = getDeviceImeis(serial);
      return {
        serialId: serial.id,
        productId: serial.productId,
        barcode: serial.barcode,
        imeis,
        imeiLabel: imeis.length > 0 ? formatDeviceImeisLabel(imeis) : "—",
        retailPrice: getSerialEffectiveRetailPrice(
          {
            unitCost: serial.unitCost,
            retailPrice: serial.retailPrice,
            purchaseItemRetailPrice: serial.purchaseItem?.retailPrice,
            stockEntryItemRetailPrice: serial.stockEntryItem?.retailPrice,
          },
          serial.retailPrice
        ),
        product: serial.product,
      };
    });
}

export async function listActivePhoneReservations(db: Db, branchId: string, search: string) {
  const q = search.trim();
  const rows = await db.phoneReservation.findMany({
    where: {
      branchId,
      status: PHONE_RESERVATION_STATUS.ACTIVE,
      ...(q
        ? {
            OR: [
              { customer: { nameAr: { contains: q, mode: "insensitive" } } },
              { customer: { phone: { contains: q, mode: "insensitive" } } },
              { notes: { contains: q, mode: "insensitive" } },
              {
                serial: {
                  OR: [
                    { barcode: { contains: q, mode: "insensitive" } },
                    {
                      imeiEntries: {
                        some: { imei: { contains: q, mode: "insensitive" } },
                      },
                    },
                    {
                      product: {
                        OR: [
                          { nameAr: { contains: q, mode: "insensitive" } },
                          { brand: { contains: q, mode: "insensitive" } },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: reservationInclude,
    orderBy: { reservedAt: "desc" },
    take: 200,
  });

  return rows.map(mapReservationRow);
}

export async function getPhoneReservationById(db: Db, branchId: string, id: string) {
  const row = await db.phoneReservation.findFirst({
    where: { id, branchId },
    include: reservationInclude,
  });
  if (!row) return null;
  return mapReservationRow(row);
}

export async function createPhoneReservation(
  db: DbRoot,
  input: {
    branchId: string;
    companyId: string;
    serialId: string;
    customerId: string;
    userId: string;
    notes?: string | null;
  }
) {
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, companyId: input.companyId, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      throw new PhoneReservationError("العميل غير موجود", "CUSTOMER_NOT_FOUND");
    }

    const serial = await tx.productSerial.findFirst({
      where: {
        id: input.serialId,
        branchId: input.branchId,
        status: PHONE_SERIAL_STATUS.AVAILABLE,
        product: { companyId: input.companyId, type: "phone", deletedAt: null, isActive: true },
      },
      select: { id: true, productId: true },
    });
    if (!serial) {
      throw new PhoneReservationError("الجهاز غير متاح للحجز", "SERIAL_NOT_AVAILABLE");
    }

    const existingActive = await tx.phoneReservation.findFirst({
      where: {
        serialId: input.serialId,
        status: PHONE_RESERVATION_STATUS.ACTIVE,
      },
      select: { id: true },
    });
    if (existingActive) {
      throw new PhoneReservationError("الجهاز محجوز بالفعل", "ALREADY_RESERVED");
    }

    const updated = await tx.productSerial.updateMany({
      where: { id: input.serialId, status: PHONE_SERIAL_STATUS.AVAILABLE },
      data: { status: PHONE_SERIAL_STATUS.RESERVED },
    });
    if (updated.count !== 1) {
      throw new PhoneReservationError("الجهاز غير متاح للحجز", "SERIAL_NOT_AVAILABLE");
    }

    const reservation = await tx.phoneReservation.create({
      data: {
        branchId: input.branchId,
        serialId: input.serialId,
        customerId: input.customerId,
        userId: input.userId,
        notes: input.notes?.trim() || null,
        status: PHONE_RESERVATION_STATUS.ACTIVE,
      },
      include: reservationInclude,
    });

    await syncPhoneInventoryQuantity(tx, input.branchId, serial.productId);

    return mapReservationRow(reservation);
  });
}

export async function cancelPhoneReservation(db: DbRoot, branchId: string, reservationId: string) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.phoneReservation.findFirst({
      where: { id: reservationId, branchId, status: PHONE_RESERVATION_STATUS.ACTIVE },
      include: { serial: { select: { id: true, productId: true } } },
    });
    if (!reservation) {
      throw new PhoneReservationError("الحجز غير موجود أو منتهٍ", "RESERVATION_NOT_ACTIVE");
    }

    const updated = await tx.productSerial.updateMany({
      where: { id: reservation.serialId, status: PHONE_SERIAL_STATUS.RESERVED },
      data: { status: PHONE_SERIAL_STATUS.AVAILABLE },
    });
    if (updated.count !== 1) {
      throw new PhoneReservationError("تعذّر إلغاء الحجز — حالة الجهاز غير متوقعة", "SERIAL_STATE_INVALID");
    }

    const row = await tx.phoneReservation.update({
      where: { id: reservationId },
      data: {
        status: PHONE_RESERVATION_STATUS.CANCELLED,
        cancelledAt: new Date(),
      },
      include: reservationInclude,
    });

    await syncPhoneInventoryQuantity(tx, branchId, reservation.serial.productId);

    return mapReservationRow(row);
  });
}

export async function completePhoneReservationForSale(
  tx: Db,
  branchId: string,
  reservationId: string,
  saleId: string
) {
  const reservation = await tx.phoneReservation.findFirst({
    where: { id: reservationId, branchId, status: PHONE_RESERVATION_STATUS.ACTIVE },
    select: { id: true, serialId: true, customerId: true },
  });
  if (!reservation) {
    throw new PhoneReservationError("الحجز غير موجود أو مكتمل", "RESERVATION_NOT_ACTIVE");
  }

  await tx.phoneReservation.update({
    where: { id: reservationId },
    data: {
      status: PHONE_RESERVATION_STATUS.COMPLETED,
      completedAt: new Date(),
      saleId,
    },
  });

  return reservation;
}

export async function loadActiveReservationForSale(
  tx: Db,
  branchId: string,
  reservationId: string
) {
  const reservation = await tx.phoneReservation.findFirst({
    where: {
      id: reservationId,
      branchId,
      status: PHONE_RESERVATION_STATUS.ACTIVE,
    },
    include: {
      serial: { select: serialWithImeisSelect },
      customer: { select: { id: true, nameAr: true, phone: true } },
    },
  });

  if (!reservation) {
    throw new PhoneReservationError("الحجز غير موجود أو مكتمل", "RESERVATION_NOT_ACTIVE");
  }

  if (reservation.serial.status !== PHONE_SERIAL_STATUS.RESERVED) {
    throw new PhoneReservationError("حالة الجهاز لا تطابق الحجز", "SERIAL_STATE_INVALID");
  }

  return reservation;
}

export async function findAvailableSerialForReservationSearch(
  db: Db,
  branchId: string,
  q: string
) {
  const trimmed = q.trim();
  if (!trimmed) return null;

  const byImei = await findDeviceSerialByImei(db, branchId, trimmed, {
    status: PHONE_SERIAL_STATUS.AVAILABLE,
  });
  if (byImei) return byImei;

  return findDeviceSerialByBarcode(db, branchId, trimmed, {
    status: PHONE_SERIAL_STATUS.AVAILABLE,
  });
}
