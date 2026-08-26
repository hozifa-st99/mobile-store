import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScreenAccess } from "@/lib/api-auth";
import {
  assertPartyBelongsToCompany,
  ledgerErrorToResponse,
  MANUAL_LEDGER_ENTRY_WHERE,
  outstanding,
  parseLedgerNotes,
  syncEntryPaidAmountFromMovements,
  type PartyType,
} from "@/lib/credit-ledger-service";

function parsePartyType(value: string | null): PartyType | null {
  if (value === "supplier" || value === "customer") return value;
  return null;
}

function staggeredPaidAt(baseMs: number, step: number) {
  return new Date(baseMs + step * 1000);
}

function entryDateWithStaggeredTime(entryDate: Date, baseMs: number, step: number) {
  const t = staggeredPaidAt(baseMs, step);
  return new Date(
    entryDate.getFullYear(),
    entryDate.getMonth(),
    entryDate.getDate(),
    t.getHours(),
    t.getMinutes(),
    t.getSeconds(),
    t.getMilliseconds()
  );
}

function mapEntry(entry: {
  id: string;
  partyType: string;
  entryDate: Date;
  creditAmount: number;
  paidAmount: number;
  notes: string | null;
  supplier: { id: string; nameAr: string; phone: string | null } | null;
  customer: { id: string; nameAr: string; phone: string | null } | null;
}) {
  const party = entry.partyType === "supplier" ? entry.supplier : entry.customer;
  return {
    id: entry.id,
    partyType: entry.partyType,
    partyId: party?.id ?? null,
    partyName: party?.nameAr ?? "—",
    partyPhone: party?.phone ?? null,
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

    const entries = await prisma.creditLedgerEntry.findMany({
      where: {
        companyId: auth.companyId,
        partyType,
        ...MANUAL_LEDGER_ENTRY_WHERE,
      },
      include: {
        supplier: { select: { id: true, nameAr: true, phone: true } },
        customer: { select: { id: true, nameAr: true, phone: true } },
        payments: { select: { paidAt: true, createdAt: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });

    const mapped = entries.map(mapEntry).filter((e) => !onlyOutstanding || e.outstanding > 0.0001);

    const partyMap = new Map<
      string,
      {
        partyId: string;
        partyName: string;
        partyPhone: string | null;
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
      const raw = entries.find(
        (e) =>
          (e.supplier?.id === row.partyId || e.customer?.id === row.partyId) &&
          e.id === row.id
      );
      const paymentDates =
        raw?.payments.map((p) => Math.max(p.paidAt.getTime(), p.createdAt.getTime())) ?? [];
      const activityTs = Math.max(new Date(row.entryDate).getTime(), ...paymentDates, 0);

      const prev = partyMap.get(row.partyId) ?? {
        partyId: row.partyId,
        partyName: row.partyName,
        partyPhone: row.partyPhone,
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
      partyMap.set(row.partyId, prev);
    }

    const partyOptions = Array.from(partyMap.values())
      .filter((p) => !onlyOutstanding || p.outstanding > 0.0001)
      .map((p) => ({
        partyId: p.partyId,
        partyName: p.partyName,
        partyPhone: p.partyPhone,
      }))
      .sort((a, b) => a.partyName.localeCompare(b.partyName, "ar"));

    let partyReport = partyOptions.map((option) => partyMap.get(option.partyId)!);

    if (partyId) {
      partyReport = partyReport.filter((p) => p.partyId === partyId);
    }

    if (search) {
      partyReport = partyReport.filter(
        (p) =>
          p.partyName.includes(search) || (p.partyPhone?.includes(search) ?? false)
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

    return NextResponse.json({
      entries: mapped,
      totals: {
        creditAmount: Math.round(totals.creditAmount * 100) / 100,
        paidAmount: Math.round(totals.paidAmount * 100) / 100,
        outstanding: Math.round(totals.outstanding * 100) / 100,
      },
      partyReport,
      partyOptions,
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
    const entryDate = body.entryDate ? new Date(body.entryDate) : new Date();

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

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.creditLedgerEntry.create({
        data: {
          companyId: auth.companyId,
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
        },
      });

      const movementBase = Date.now();
      let step = 0;

      await tx.creditLedgerPayment.create({
        data: {
          entryId: created.id,
          movementType: "credit_open",
          amount: creditAmount,
          paidAt: entryDateWithStaggeredTime(entryDate, movementBase, step++),
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
            paidAt: entryDateWithStaggeredTime(entryDate, movementBase, step++),
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
