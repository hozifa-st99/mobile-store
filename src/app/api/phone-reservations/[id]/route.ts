import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  cancelPhoneReservation,
  getPhoneReservationById,
  PhoneReservationError,
} from "@/lib/phone-reservation-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  const reservation = await getPhoneReservationById(prisma, auth.branchId, id);
  if (!reservation) {
    return NextResponse.json({ message: "الحجز غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ reservation });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthFromRequest(_request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const reservation = await cancelPhoneReservation(prisma, auth.branchId, id);
    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof PhoneReservationError) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ message: "تعذّر إلغاء الحجز" }, { status: 500 });
  }
}
