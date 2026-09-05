import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScreenAccess } from "@/lib/api-auth";
import {
  assertOptionalManualBranchReference,
  assertPartyBelongsToCompany,
  ledgerErrorToResponse,
  MANUAL_LEDGER_ENTRY_WHERE,
  manualBranchEntryWhere,
  outstanding,
  parseLedgerEntryDate,
  parseLedgerNotes,
  parseManualBranchFilter,
  partyBranchReportKey,
  syncEntryPaidAmountFromMovements,
  type PartyType,
} from "@/lib/credit-ledger-service";

function parsePartyType(value: string | null): PartyType | null {
  if (value === "supplier" || value === "customer") return value;
  return null;
}

function mapEntry(entry: {
  id: string;
  partyType: string;
  branchId: string | null;
  entryDate: Date;
  creditAmount: number;
  paidAmount: number;
  notes: string | null;
  supplier: { id: string; nameAr: string; phone: string | null } | null;
  customer: { id: string; nameAr: string; phone: string | null } | null;
  branch: { id: string; nameAr: string } | null;
}) {
  const party = entry.partyType === "supplier" ? entry.supplier : entry.customer;
  const partyId = party?.id ?? null;
  return {
    id: entry.id,
    partyType: entry.partyType,
    partyId,
    partyName: party?.nameAr ?? "—",
    partyPhone: party?.phone ?? null,
    branchId: entry.branchId,
    branchName: entry.branch?.nameAr ?? null,
    reportKey: partyId ? partyBranchReportKey(partyId, entry.branchId) : entry.id,
    entryDate: entry.entryDate.toISOString(),
    creditAmount: entry.creditAmount,
    paidAmount: entry.paidAmount,
    outstanding: outstanding(entry.creditAmount, entry.paidAmount),
    notes: entry.notes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { auth, error } = await requireScreenAccess(request, "debts");
    if (error || !auth) return error!;

    const { searchParams } = new URL(request.url);
    const partyType = parsePartyType(searchParams.get("partyType"));
    if (!partyType) {
      return NextResponse.json({ message: "نوع الطرف مطلوب (supplier أو customer)" }, { status: 400 });
    }

    const onlyOutstanding = searchParams.get("onlyOutstanding") === "1";
    const search = (searchParams.get("search") || "").trim();
    const partyId = (searchParams.get("partyId") || "").trim();
    const branchFilter = parseManualBranchFilter(searchParams.get("branchId"));

    const entries = await prisma.creditLedgerEntry.findMany({
      where: {
        companyId: auth.companyId,
        partyType,
        ...MANUAL_LEDGER_ENTRY_WHERE,
        ...manualBranchEntryWhere(branchFilter),
      },
      include: {
        supplier: { select: { id: true, nameAr: true, phone: true } },
        customer: { select: { id: true, nameAr: true, phone: true } },
        branch: { select: { id: true, nameAr: true } },
        payments: { select: { paidAt: true, createdAt: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });

    const mapped = entries.map(mapEntry).filter((e) => !onlyOutstanding || e.outstanding > 0.0001);

    const partyMap = new Map<
      string,
      {
        reportKey: string;
        partyId: string;
        partyName: string;
        partyPhone: string | null;
        branchId: string | null;
        branchName: string | null;
        creditAmount: number;
        paidAmount: number;
        outstanding: number;
        entryCount: number;
        firstEntryDate: string;
        lastActivityDate: string;
      }
    >();

    for (const row of mapped) {
      if (!row.partyId) continue;
      const raw = entries.find((e) => e.id === row.id);
      const paymentDates =
        raw?.payments.map((p) => Math.max(p.paidAt.getTime(), p.createdAt.getTime())) ?? [];
      const activityTs = Math.max(new Date(row.entryDate).getTime(), ...paymentDates, 0);

      const prev = partyMap.get(row.reportKey) ?? {
        reportKey: row.reportKey,
        partyId: row.partyId,
        partyName: row.partyName,
        partyPhone: row.partyPhone,
        branchId: row.branchId,
        branchName: row.branchName,
        creditAmount: 0,
        paidAmount: 0,
        outstanding: 0,
        entryCount: 0,
        firstEntryDate: row.entryDate,
        lastActivityDate: new Date(activityTs).toISOString(),
      };

      prev.creditAmount += row.creditAmount;
      prev.paidAmount += row.paidAmount;
      prev.outstanding += row.outstanding;
      prev.entryCount += 1;
      if (new Date(row.entryDate) < new Date(prev.firstEntryDate)) {
        prev.firstEntryDate = row.entryDate;
      }
      if (activityTs > new Date(prev.lastActivityDate).getTime()) {
        prev.lastActivityDate = new Date(activityTs).toISOString();
      }
      partyMap.set(row.reportKey, prev);
    }

    const partyOptions = Array.from(
      new Map(
        Array.from(partyMap.values()).map((p) => [
          p.partyId,
          {
            partyId: p.partyId,
            partyName: p.partyName,
            partyPhone: p.partyPhone,
          },
        ])
      ).values()
    ).sort((a, b) => a.partyName.localeCompare(b.partyName, "ar"));

    let partyReport = Array.from(partyMap.values());

    if (partyId) {
      partyReport = partyReport.filter((p) => p.partyId === partyId);
    }

    if (search) {
      partyReport = partyReport.filter(
        (p) =>
          p.partyName.includes(search) ||
          (p.partyPhone?.includes(search) ?? false) ||
          (p.branchName?.includes(search) ?? false)
      );
    }

    partyReport.sort(
      (a, b) =>
        new Date(a.lastActivityDate).getTime() - new Date(b.lastActivityDate).getTime()
    );

    const totals = partyReport.reduce(
      (acc, row) => {
        acc.creditAmount += row.creditAmount;
        acc.paidAmount += row.paidAmount;
        acc.outstanding += row.outstanding;
        return acc;
      },
      { creditAmount: 0, paidAmount: 0, outstanding: 0 }
    );

    const branchOptions = await prisma.branch.findMany({
      where: { companyId: auth.companyId, isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({
      entries: mapped,
      totals: {
        creditAmount: Math.round(totals.creditAmount * 100) / 100,
        paidAmount: Math.round(totals.paidAmount * 100) / 100,
        outstanding: Math.round(totals.outstanding * 100) / 100,
      },
      partyReport,
      partyOptions,
      branchOptions: branchOptions.map((branch) => ({
        branchId: branch.id,
        branchName: branch.nameAr,
      })),
    });
  } catch (err) {
    console.error("credit-ledger GET:", err);
    return NextResponse.json(
      { message: "تعذّر تحميل سجل الديون — أعد تشغيل السيرفر بعد npx prisma generate" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, error } = await requireScreenAccess(request, "debts");
    if (error || !auth) return error!;

    const body = await request.json();
    const partyType = parsePartyType(body.partyType);
    const supplierId = body.supplierId as string | undefined;
    const customerId = body.customerId as string | undefined;
    const partyId = partyType === "supplier" ? supplierId : customerId;
    const creditAmount = Number(body.creditAmount);
    const paidAmount = body.paidAmount != null ? Number(body.paidAmount) : 0;
    const notes = parseLedgerNotes(body.notes);
    const entryDate = parseLedgerEntryDate(body.entryDate);

    if (!partyType || !partyId) {
      return NextResponse.json({ message: "نوع الطرف والاسم مطلوبان" }, { status: 400 });
    }
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return NextResponse.json({ message: "المبلغ الآجل يجب أن يكون أكبر من صفر" }, { status: 400 });
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return NextResponse.json({ message: "المبلغ المدفوع غير صالح" }, { status: 400 });
    }
    if (paidAmount > creditAmount) {
      return NextResponse.json({ message: "المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الآجل" }, { status: 400 });
    }
    if (Number.isNaN(entryDate.getTime())) {
      return NextResponse.json({ message: "التاريخ غير صالح" }, { status: 400 });
    }

    await assertPartyBelongsToCompany(prisma, auth.companyId, partyType, partyId, {
      requireActive: true,
    });
    const branchId = await assertOptionalManualBranchReference(prisma, auth.companyId, body.branchId);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.creditLedgerEntry.create({
        data: {
          companyId: auth.companyId,
          branchId,
          partyType,
          supplierId: partyType === "supplier" ? supplierId : null,
          customerId: partyType === "customer" ? customerId : null,
          entryDate,
          creditAmount,
          paidAmount,
          notes,
          createdByUserId: auth.userId,
        },
        include: {
          supplier: { select: { id: true, nameAr: true, phone: true } },
          customer: { select: { id: true, nameAr: true, phone: true } },
          branch: { select: { id: true, nameAr: true } },
        },
      });

      await tx.creditLedgerPayment.create({
        data: {
          entryId: created.id,
          movementType: "credit_open",
          amount: creditAmount,
          paidAt: entryDate,
          notes,
          createdByUserId: auth.userId,
        },
      });

      if (paidAmount > 0.0001) {
        await tx.creditLedgerPayment.create({
          data: {
            entryId: created.id,
            movementType: "payment",
            amount: paidAmount,
            paidAt: new Date(entryDate.getTime() + 1000),
            notes: "دفعة عند التسجيل",
            createdByUserId: auth.userId,
          },
        });
      }

      await syncEntryPaidAmountFromMovements(tx, created.id);

      return created;
    });

    return NextResponse.json(
      {
        entry: mapEntry(entry),
      },
      { status: 201 }
    );
  } catch (err) {
    const mapped = ledgerErrorToResponse(err);
    if (mapped) {
      return NextResponse.json({ message: mapped.message }, { status: mapped.status });
    }
    console.error("credit-ledger POST:", err);
    return NextResponse.json({ message: "تعذّر حفظ السجل" }, { status: 500 });
  }
}
