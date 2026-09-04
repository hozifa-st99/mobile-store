import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScreenAccess } from "@/lib/api-auth";
import {
  applyPartyPayment,
  assertOptionalManualBranchReference,
  assertPartyBelongsToCompany,
  buildPartyTimeline,
  ledgerErrorToResponse,
  MANUAL_LEDGER_ENTRY_WHERE,
  manualBranchEntryWhere,
  outstanding,
  parseLedgerNotes,
  parseManualBranchFilter,
  parseOptionalPaidAt,
  partyWhere,
  runSerializableLedgerTransaction,
  type PartyType,
} from "@/lib/credit-ledger-service";

function parsePartyType(value: string | null): PartyType | null {
  if (value === "supplier" || value === "customer") return value;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { auth, error } = await requireScreenAccess(request, "debts");
    if (error || !auth) return error!;

    const { searchParams } = new URL(request.url);
    const partyType = parsePartyType(searchParams.get("partyType"));
    const partyId = searchParams.get("partyId");
    const branchFilter = parseManualBranchFilter(searchParams.get("branchId"));

    if (!partyType || !partyId) {
      return NextResponse.json({ message: "معرّف الطرف مطلوب" }, { status: 400 });
    }

    await assertPartyBelongsToCompany(prisma, auth.companyId, partyType, partyId);

    const entries = await prisma.creditLedgerEntry.findMany({
      where: {
        companyId: auth.companyId,
        partyType,
        ...partyWhere(partyType, partyId),
        ...MANUAL_LEDGER_ENTRY_WHERE,
        ...manualBranchEntryWhere(branchFilter),
      },
      include: {
        supplier: { select: { id: true, nameAr: true, phone: true } },
        customer: { select: { id: true, nameAr: true, phone: true } },
        branch: { select: { id: true, nameAr: true } },
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });

    if (entries.length === 0) {
      return NextResponse.json({ message: "لا يوجد سجل لهذا الطرف" }, { status: 404 });
    }

    const entryIds = entries.map((e) => e.id);

    const movements = await prisma.creditLedgerPayment.findMany({
      where: { entryId: { in: entryIds } },
      include: {
        createdBy: { select: { fullNameAr: true } },
      },
      orderBy: [{ createdAt: "asc" }, { paidAt: "asc" }],
    });

    const party = partyType === "supplier" ? entries[0].supplier : entries[0].customer;
    const creditAmount = entries.reduce((s, e) => s + e.creditAmount, 0);
    const paidAmount = entries.reduce((s, e) => s + e.paidAmount, 0);

    return NextResponse.json({
      party: {
        partyId,
        partyType,
        partyName: party?.nameAr ?? "—",
        partyPhone: party?.phone ?? null,
        branchId: entries[0].branchId,
        branchName: entries[0].branch?.nameAr ?? null,
        firstEntryDate: entries[0].entryDate.toISOString(),
        creditAmount,
        paidAmount,
        outstanding: Math.max(0, outstanding(creditAmount, paidAmount)),
      },
      timeline: buildPartyTimeline(movements, entries),
    });
  } catch (err) {
    const mapped = ledgerErrorToResponse(err);
    if (mapped) {
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    console.error("credit-ledger party GET:", err);
    return NextResponse.json({ message: "تعذّر تحميل التفاصيل" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth, error } = await requireScreenAccess(request, "debts");
    if (error || !auth) return error!;

    const body = await request.json();
    const partyType = parsePartyType(body.partyType);
    const partyId = body.partyId as string | undefined;
    const amount = Number(body.addPayment);

    if (!partyType || !partyId) {
      return NextResponse.json({ message: "الطرف مطلوب" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "مبلغ الدفعة غير صالح" }, { status: 400 });
    }

    const notes = parseLedgerNotes(body.notes);
    const paidAt = parseOptionalPaidAt(body.paidAt);
    const branchId = await assertOptionalManualBranchReference(prisma, auth.companyId, body.branchId);

    await runSerializableLedgerTransaction(prisma, async (tx) => {
      await applyPartyPayment(
        tx,
        auth.companyId,
        partyType,
        partyId,
        amount,
        paidAt,
        notes,
        auth.userId,
        branchId
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const mapped = ledgerErrorToResponse(err);
    if (mapped) {
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    console.error("credit-ledger party PATCH:", err);
    return NextResponse.json({ message: "تعذّر تسجيل الدفعة" }, { status: 500 });
  }
}
