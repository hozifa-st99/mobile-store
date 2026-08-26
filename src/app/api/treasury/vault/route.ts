import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { listBranchVaultMovements, parseBranchVaultMovementType } from "@/lib/branch-vault";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const invoiceNumber = searchParams.get("invoiceNumber")?.trim() || undefined;
  const typeRaw = searchParams.get("type")?.trim();
  const type = typeRaw ? parseBranchVaultMovementType(typeRaw) ?? undefined : undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const data = await listBranchVaultMovements(auth.branchId, {
    dateFrom,
    dateTo,
    invoiceNumber,
    type,
    limit,
  });
  return NextResponse.json(data);
}
