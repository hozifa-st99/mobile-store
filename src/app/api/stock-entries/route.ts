import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { createStockEntry, getStockEntryErrorResponse } from "@/lib/stock-entry-service";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const documentNumber = searchParams.get("documentNumber")?.trim();

  const entries = await prisma.stockEntry.findMany({
    where: {
      branchId: auth.branchId,
      ...(documentNumber ? { documentNumber: { contains: documentNumber } } : {}),
    },
    orderBy: { entryDate: "desc" },
    take: 100,
    select: {
      id: true,
      documentNumber: true,
      entryDate: true,
      total: true,
      status: true,
      notes: true,
    },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { documentNumber, entryDate, notes, items = [] } = body;

    const entry = await prisma.$transaction((tx) =>
      createStockEntry(tx, auth, {
        documentNumber: documentNumber?.trim(),
        entryDate,
        notes,
        items,
      })
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Stock entry error:", error);
    const { message, status } = getStockEntryErrorResponse(error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "رقم المستند مكرر — حدّث الصفحة" }, { status: 400 });
    }
    return NextResponse.json({ message }, { status });
  }
}
