import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const entry = await prisma.stockEntry.findFirst({
    where: { id: params.id, branchId: auth.branchId },
    include: {
      items: {
        orderBy: { description: "asc" },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ message: "المستند غير موجود" }, { status: 404 });
  }

  return NextResponse.json({
    entry: {
      ...entry,
      entryDate: entry.entryDate.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    },
  });
}
