import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, requireScreenAccess, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  createPhoneReservation,
  listActivePhoneReservations,
  listAvailablePhonesForReservation,
  PhoneReservationError,
} from "@/lib/phone-reservation-service";

export async function GET(request: NextRequest) {
  const { error: accessError } = await requireScreenAccess(request, "phone_reservations");
  if (accessError) return accessError;

  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "reserved" ? "reserved" : "available";
  const search = searchParams.get("search")?.trim() || "";

  try {
    if (tab === "reserved") {
      const reservations = await listActivePhoneReservations(prisma, auth.branchId, search);
      return NextResponse.json({ reservations });
    }

    const phones = await listAvailablePhonesForReservation(
      prisma,
      auth.branchId,
      auth.companyId,
      search
    );
    return NextResponse.json({ phones });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "تعذّر تحميل البيانات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error: accessError } = await requireScreenAccess(request, "phone_reservations");
  if (accessError) return accessError;

  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const serialId = String(body.serialId || "").trim();
    const customerId = String(body.customerId || "").trim();
    const notes = body.notes != null ? String(body.notes) : null;

    if (!serialId || !customerId) {
      return NextResponse.json({ message: "اختر الجهاز والعميل" }, { status: 400 });
    }

    const reservation = await createPhoneReservation(prisma, {
      branchId: auth.branchId,
      companyId: auth.companyId,
      serialId,
      customerId,
      userId: auth.userId,
      notes,
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof PhoneReservationError) {
      const status =
        error.code === "CUSTOMER_NOT_FOUND"
          ? 404
          : error.code === "SERIAL_NOT_AVAILABLE" || error.code === "ALREADY_RESERVED"
            ? 400
            : 400;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ message: "تعذّر إنشاء الحجز" }, { status: 500 });
  }
}
