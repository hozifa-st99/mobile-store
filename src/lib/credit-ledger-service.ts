import { Prisma, type PrismaClient } from "@prisma/client";

export type PartyType = "supplier" | "customer";
export type MovementType = "credit_open" | "credit_add" | "payment";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type TimelineEvent = {
  id: string;
  type: "credit" | "payment" | "combined";
  label: string;
  date: string;
  amount: number;
  creditAmount?: number;
  paidAmount?: number;
  balanceAfter: number;
  notes: string | null;
  recordedByName?: string | null;
  sortTs: number;
  sortOrder: number;
};

const BUNDLED_PAYMENT_NOTE = "دفعة عند التسجيل";
const PAIR_WINDOW_MS = 5000;

export const LEDGER_NOTES_MAX = 500;

/** قيود الديون الخارجية اليدوية فقط — من غير فواتير الشراء */
export const MANUAL_LEDGER_ENTRY_WHERE = { purchaseId: null } as const;

export class LedgerValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOTES_TOO_LONG"
      | "INVALID_DATE"
      | "PARTY_NOT_FOUND"
      | "OVERPAY"
      | "NO_OUTSTANDING"
      | "NOT_FOUND"
  ) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

export function parseLedgerNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > LEDGER_NOTES_MAX) {
    throw new LedgerValidationError("الملاحظات طويلة جداً", "NOTES_TOO_LONG");
  }
  return trimmed;
}

export function parseOptionalPaidAt(value: unknown): Date {
  if (value == null || value === "") return new Date();
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throw new LedgerValidationError("التاريخ غير صالح", "INVALID_DATE");
  }
  return parsed;
}

export async function assertPartyBelongsToCompany(
  db: Tx | PrismaClient,
  companyId: string,
  partyType: PartyType,
  partyId: string,
  options?: { requireActive?: boolean }
) {
  const requireActive = options?.requireActive ?? false;
  const where = {
    id: partyId,
    companyId,
    ...(requireActive ? { isActive: true } : {}),
  };

  if (partyType === "supplier") {
    const supplier = await db.supplier.findFirst({ where });
    if (!supplier) {
      throw new LedgerValidationError("المورد غير موجود", "PARTY_NOT_FOUND");
    }
    return supplier;
  }

  const customer = await db.customer.findFirst({ where });
  if (!customer) {
    throw new LedgerValidationError("العميل غير موجود", "PARTY_NOT_FOUND");
  }
  return customer;
}

function isBundledPayment(notes: string | null) {
  return notes === BUNDLED_PAYMENT_NOTE;
}

function mergeBundledNotes(creditNotes: string | null, paymentNotes: string | null) {
  const parts = [creditNotes?.trim(), paymentNotes?.trim()].filter(
    (note) => note && note !== BUNDLED_PAYMENT_NOTE
  );
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : null;
}

function combinedLabel(creditLabel: string) {
  if (creditLabel.includes("إضافة")) return "إضافة آجل + دفعة";
  return "تسجيل دين / أجل + دفعة";
}

function mergePairedCreditPayments(events: TimelineEvent[]) {
  const merged: TimelineEvent[] = [];
  let index = 0;

  while (index < events.length) {
    const credit = events[index];
    const payment = events[index + 1];

    if (
      credit.type === "credit" &&
      payment?.type === "payment" &&
      payment.sortTs - credit.sortTs <= PAIR_WINDOW_MS &&
      isBundledPayment(payment.notes)
    ) {
      merged.push({
        id: `${credit.id}+${payment.id}`,
        type: "combined",
        label: combinedLabel(credit.label),
        date: credit.date,
        amount: credit.amount,
        creditAmount: credit.amount,
        paidAmount: payment.amount,
        balanceAfter: 0,
        notes: mergeBundledNotes(credit.notes, payment.notes),
        recordedByName: credit.recordedByName ?? payment.recordedByName ?? null,
        sortTs: credit.sortTs,
        sortOrder: credit.sortOrder,
      });
      index += 2;
      continue;
    }

    merged.push(credit);
    index += 1;
  }

  return merged;
}

function movementChronoPriority(movementType: string) {
  if (movementType === "credit_open") return 1;
  if (movementType === "credit_add") return 2;
  if (movementType === "payment") return 3;
  return 1;
}

function timelineChronoPriority(event: Pick<TimelineEvent, "type" | "label">) {
  if (event.type === "payment") return 3;
  if (event.label.includes("إضافة")) return 2;
  return 1;
}

function compareTimelineEvents(a: TimelineEvent, b: TimelineEvent) {
  if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
  return timelineChronoPriority(a) - timelineChronoPriority(b);
}

function isDateOnlyTimestamp(value: Date) {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

/** وقت العرض والترتيب — يفضّل createdAt عندما paidAt تاريخ فقط (منتصف الليل) */
export function movementTimelineInstant(movement: { paidAt: Date; createdAt?: Date }) {
  if (movement.createdAt && isDateOnlyTimestamp(movement.paidAt)) {
    return movement.createdAt;
  }
  return movement.paidAt;
}

export function outstanding(creditAmount: number, paidAmount: number) {
  return Math.round((creditAmount - paidAmount) * 100) / 100;
}

export function partyWhere(partyType: PartyType, partyId: string) {
  return partyType === "supplier" ? { supplierId: partyId } : { customerId: partyId };
}


function movementLabel(type: string) {
  if (type === "payment") return "تسجيل دفعة";
  if (type === "credit_add") return "إضافة آجل";
  return "بداية الدين / الأجل";
}

export function buildPartyTimeline(
  movements: {
    id: string;
    entryId?: string;
    movementType: string;
    amount: number;
    paidAt: Date;
    notes: string | null;
    createdAt?: Date;
    createdBy?: { fullNameAr: string } | null;
  }[],
  entries: { id: string; entryDate: Date }[]
) {
  const candidates: TimelineEvent[] = [];
  const sortedEntries = [...entries].sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime()
  );

  for (const entry of sortedEntries) {
    const entryMovements = movements
      .filter((m) => m.entryId === entry.id)
      .sort((a, b) => {
        const diff =
          movementTimelineInstant(a).getTime() - movementTimelineInstant(b).getTime();
        if (diff !== 0) return diff;
        return movementChronoPriority(a.movementType) - movementChronoPriority(b.movementType);
      });

    for (const movement of entryMovements) {
      const isPayment = movement.movementType === "payment";
      const instant = movementTimelineInstant(movement);
      candidates.push({
        id: movement.id,
        type: isPayment ? "payment" : "credit",
        label: movementLabel(movement.movementType),
        date: instant.toISOString(),
        amount: movement.amount,
        balanceAfter: 0,
        notes: movement.notes,
        recordedByName: movement.createdBy?.fullNameAr ?? null,
        sortTs: instant.getTime(),
        sortOrder: movementChronoPriority(movement.movementType),
      });
    }
  }

  candidates.sort(compareTimelineEvents);
  const displayEvents = mergePairedCreditPayments(candidates);

  let balance = 0;
  for (const event of displayEvents) {
    if (event.type === "combined") {
      balance += event.creditAmount ?? event.amount;
      balance -= event.paidAmount ?? 0;
    } else if (event.type === "credit") {
      balance += event.amount;
    } else {
      balance -= event.amount;
    }
    event.balanceAfter = Math.max(0, Math.round(balance * 100) / 100);
  }

  return displayEvents.map(({ sortTs: _sortTs, sortOrder: _sortOrder, ...event }) => event);
}

export async function syncEntryPaidAmountFromMovements(tx: Tx, entryId: string) {
  const entry = await tx.creditLedgerEntry.findUnique({
    where: { id: entryId },
    select: { creditAmount: true },
  });
  if (!entry) return null;

  const movements = await tx.creditLedgerPayment.findMany({
    where: { entryId },
    select: { movementType: true, amount: true },
  });

  const paidAmount = Math.min(
    entry.creditAmount,
    Math.round(
      movements
        .filter((m) => m.movementType === "payment")
        .reduce((sum, m) => sum + m.amount, 0) * 100
    ) / 100
  );

  return tx.creditLedgerEntry.update({
    where: { id: entryId },
    data: { paidAmount },
  });
}

export function ledgerErrorToResponse(err: unknown): { status: number; message: string } | null {
  if (!(err instanceof LedgerValidationError)) return null;

  const status =
    err.code === "PARTY_NOT_FOUND" || err.code === "NOT_FOUND"
      ? 404
      : 400;

  return { status, message: err.message };
}

function isPrismaSerializationConflict(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "P2034" ||
    e.message?.includes("SQLITE_BUSY") ||
    e.message?.includes("database is locked")
  );
}

/** معاملة Serializable + إعادة محاولة — تمنع الدفع المتزامن الزائد */
export async function runSerializableLedgerTransaction<T>(
  db: PrismaClient,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (err) {
      lastError = err;
      if (!isPrismaSerializationConflict(err) || attempt === maxAttempts - 1) {
        throw err;
      }
    }
  }

  throw lastError;
}

async function sumEntryPayments(tx: Tx, entryId: string) {
  const movements = await tx.creditLedgerPayment.findMany({
    where: { entryId, movementType: "payment" },
    select: { amount: true },
  });
  return Math.round(movements.reduce((sum, m) => sum + m.amount, 0) * 100) / 100;
}

async function assertEntryPaymentsWithinCredit(tx: Tx, entryIds: string[]) {
  for (const entryId of entryIds) {
    const entry = await tx.creditLedgerEntry.findUnique({
      where: { id: entryId },
      select: { creditAmount: true },
    });
    if (!entry) continue;

    const paid = await sumEntryPayments(tx, entryId);
    if (paid > entry.creditAmount + 0.001) {
      throw new LedgerValidationError("مبلغ الدفعة أكبر من الرصيد المستحق", "OVERPAY");
    }
  }
}

export async function applyPartyPayment(
  tx: Tx,
  companyId: string,
  partyType: PartyType,
  partyId: string,
  amount: number,
  paidAt: Date,
  notes: string | null,
  createdByUserId: string
) {
  await assertPartyBelongsToCompany(tx, companyId, partyType, partyId);

  let remaining = Math.round(amount * 100) / 100;
  const entryIds = (
    await tx.creditLedgerEntry.findMany({
      where: {
        companyId,
        partyType,
        ...partyWhere(partyType, partyId),
        ...MANUAL_LEDGER_ENTRY_WHERE,
      },
      select: { id: true },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    })
  ).map((e) => e.id);

  if (entryIds.length === 0) {
    throw new LedgerValidationError("لا يوجد سجل لهذا الطرف", "NO_OUTSTANDING");
  }

  let totalDue = 0;
  for (const entryId of entryIds) {
    const entry = await tx.creditLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry) continue;
    const paidRecorded = await sumEntryPayments(tx, entryId);
    totalDue += Math.max(0, outstanding(entry.creditAmount, paidRecorded));
  }
  totalDue = Math.round(totalDue * 100) / 100;

  if (totalDue <= 0.0001) {
    throw new LedgerValidationError("لا يوجد رصيد مستحق", "NO_OUTSTANDING");
  }
  if (remaining > totalDue + 0.001) {
    throw new LedgerValidationError("مبلغ الدفعة أكبر من الرصيد المستحق", "OVERPAY");
  }

  const touchedEntryIds: string[] = [];

  for (const entryId of entryIds) {
    if (remaining <= 0.0001) break;

    const entry = await tx.creditLedgerEntry.findUnique({ where: { id: entryId } });
    if (!entry) continue;

    const paidRecorded = await sumEntryPayments(tx, entryId);
    const due = outstanding(entry.creditAmount, paidRecorded);
    if (due <= 0.0001) continue;

    const pay = Math.min(remaining, due);
    await tx.creditLedgerPayment.create({
      data: {
        entryId: entry.id,
        movementType: "payment",
        amount: pay,
        paidAt,
        notes,
        createdByUserId,
      },
    });
    touchedEntryIds.push(entry.id);
    await syncEntryPaidAmountFromMovements(tx, entry.id);
    remaining = Math.round((remaining - pay) * 100) / 100;
  }

  if (remaining > 0.0001) {
    throw new LedgerValidationError("مبلغ الدفعة أكبر من الرصيد المستحق", "OVERPAY");
  }

  await assertEntryPaymentsWithinCredit(tx, touchedEntryIds.length > 0 ? touchedEntryIds : entryIds);
}
