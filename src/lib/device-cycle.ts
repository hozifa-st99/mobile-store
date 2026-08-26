import "server-only";

import type { Prisma } from "@prisma/client";

import {
  normalizeDeviceImeis,
  validateDeviceImeis,
} from "@/lib/product-serial-imeis";
import type { ImeiCyclePreview } from "@/lib/imei-cycle-preview-types";

export type { ImeiCyclePreview } from "@/lib/imei-cycle-preview-types";

type Db = Prisma.TransactionClient | { productSerialImei: Prisma.TransactionClient["productSerialImei"] };

const STATUS_LABELS: Record<string, string> = {
  available: "متاح في المخزون",
  sold: "مباع",
  removed: "غير موجود (جرد أو مرتجع)",
};

export async function resolveNextCycleIndex(
  tx: Db,
  branchId: string,
  imeis: string[]
): Promise<number> {
  const normalized = normalizeDeviceImeis(imeis);
  if (normalized.length === 0) return 1;

  const rows = await tx.productSerialImei.findMany({
    where: { branchId, imei: { in: normalized } },
    select: { serial: { select: { cycleIndex: true } } },
  });

  const maxCycle = rows.reduce((max, row) => Math.max(max, row.serial.cycleIndex), 0);
  return maxCycle + 1;
}

export async function findActiveSerialIdForImei(
  tx: Db,
  branchId: string,
  imei: string,
  excludeSerialId?: string
): Promise<string | null> {
  const entry = await tx.productSerialImei.findFirst({
    where: {
      branchId,
      imei,
      serial: { status: "available" },
      ...(excludeSerialId ? { serialId: { not: excludeSerialId } } : {}),
    },
    select: { serialId: true },
  });
  return entry?.serialId ?? null;
}

async function findPreviousCycleSecondaryImei(
  tx: Db,
  branchId: string,
  currentImeis: string[]
): Promise<string | null> {
  const normalized = normalizeDeviceImeis(currentImeis);
  if (normalized.length === 0 || normalized.length >= 2) return null;

  const primary = normalized[0]!;

  const entries = await tx.productSerialImei.findMany({
    where: { branchId, imei: primary },
    select: {
      serial: {
        select: {
          cycleIndex: true,
          imeiEntries: { select: { imei: true }, orderBy: { createdAt: "asc" as const } },
        },
      },
    },
    orderBy: { serial: { cycleIndex: "desc" } },
  });

  if (entries.length === 0) return null;

  const lastCycleIndex = entries[0]!.serial.cycleIndex;
  const lastSerial = entries.find((entry) => entry.serial.cycleIndex === lastCycleIndex)?.serial;
  if (!lastSerial) return null;

  const previousImeis = normalizeDeviceImeis(lastSerial.imeiEntries.map((entry) => entry.imei));
  if (previousImeis.length < 2) return null;

  const secondary = previousImeis.find((imei) => imei !== primary);
  if (!secondary || normalized.includes(secondary)) return null;

  return secondary;
}

export async function previewImeiCycleEntry(
  tx: Db,
  branchId: string,
  imeis: string[]
): Promise<ImeiCyclePreview> {
  const normalized = normalizeDeviceImeis(imeis);
  if (normalized.length === 0) {
    return {
      nextCycleIndex: 1,
      isReEntry: false,
      blocked: true,
      blockedReason: "IMEI_REQUIRED",
      message: null,
    };
  }

  try {
    validateDeviceImeis(normalized);
  } catch {
    return {
      nextCycleIndex: 1,
      isReEntry: false,
      blocked: true,
      blockedReason: "IMEI_INVALID",
      message: null,
    };
  }

  for (const imei of normalized) {
    const activeId = await findActiveSerialIdForImei(tx, branchId, imei);
    if (activeId) {
      return {
        nextCycleIndex: 1,
        isReEntry: false,
        blocked: true,
        blockedReason: "IMEI_ACTIVE",
        message: `IMEI ${imei} موجود حالياً في المخزون — لا يمكن إدخاله مرة أخرى`,
      };
    }
  }

  const nextCycleIndex = await resolveNextCycleIndex(tx, branchId, normalized);
  const isReEntry = nextCycleIndex > 1;

  const lastEntry = await tx.productSerialImei.findFirst({
    where: { branchId, imei: { in: normalized } },
    orderBy: { serial: { cycleIndex: "desc" } },
    select: { serial: { select: { status: true, cycleIndex: true } } },
  });

  const lastStatus = lastEntry?.serial.status;
  const statusHint = lastStatus ? STATUS_LABELS[lastStatus] ?? lastStatus : null;

  let message: string | null = null;
  let suggestedSecondaryImei: string | null = null;

  if (isReEntry) {
    message = statusHint
      ? `هذا الجهاز سيدخل المخزون في الدورة ${nextCycleIndex} (آخر حالة: ${statusHint})`
      : `هذا الجهاز سيدخل المخزون في الدورة ${nextCycleIndex}`;
    suggestedSecondaryImei = await findPreviousCycleSecondaryImei(tx, branchId, normalized);
  }

  return {
    nextCycleIndex,
    isReEntry,
    blocked: false,
    lastStatus,
    message,
    suggestedSecondaryImei,
  };
}
