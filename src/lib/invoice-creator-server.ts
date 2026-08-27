import type { PrismaClient } from "@prisma/client";

import {
  invoiceCreatorSelect,
  serializeInvoiceCreator,
  type InvoiceCreatorInfo,
} from "@/lib/invoice-creator";
import { ROLES } from "@/lib/permissions";

type InvoiceDocumentKind = "sale" | "purchase";

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function loadCreatorsByIds(
  prisma: PrismaClient,
  creatorIds: string[]
): Promise<InvoiceCreatorInfo[]> {
  if (creatorIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: creatorIds },
      role: { not: ROLES.SUPER_ADMIN },
    },
    select: invoiceCreatorSelect,
    orderBy: [{ username: "asc" }],
  });

  return users
    .map((user) => serializeInvoiceCreator(user))
    .filter((user): user is InvoiceCreatorInfo => user !== null);
}

export async function listDistinctInvoiceCreators(
  prisma: PrismaClient,
  branchId: string,
  kind: InvoiceDocumentKind
): Promise<InvoiceCreatorInfo[]> {
  try {
    const rows =
      kind === "sale"
        ? await prisma.sale.findMany({
            where: { branchId, createdByUserId: { not: null } },
            select: { createdByUserId: true },
            distinct: ["createdByUserId"],
          })
        : await prisma.purchase.findMany({
            where: { branchId, createdByUserId: { not: null } },
            select: { createdByUserId: true },
            distinct: ["createdByUserId"],
          });

    return loadCreatorsByIds(
      prisma,
      rows.map((row) => row.createdByUserId)
    );
  } catch (err) {
    console.error(`listDistinctInvoiceCreators(${kind}) prisma failed:`, err);
  }

  try {
    const table = kind === "sale" ? "sales" : "purchases";
    const rows = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT DISTINCT created_by_user_id AS "userId"
       FROM ${table}
       WHERE branch_id = $1 AND created_by_user_id IS NOT NULL`,
      branchId
    );
    return loadCreatorsByIds(
      prisma,
      rows.map((row) => row.userId)
    );
  } catch (err) {
    console.error(`listDistinctInvoiceCreators(${kind}) raw query failed:`, err);
    return [];
  }
}

export async function attachInvoiceCreators<
  T extends { createdByUserId?: string | null },
>(prisma: PrismaClient, rows: T[]): Promise<(T & { createdBy: InvoiceCreatorInfo | null })[]> {
  const creatorIds = uniqueIds(rows.map((row) => row.createdByUserId));

  if (creatorIds.length === 0) {
    return rows.map((row) => ({ ...row, createdBy: null }));
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: creatorIds },
        role: { not: ROLES.SUPER_ADMIN },
      },
      select: invoiceCreatorSelect,
    });

    const creatorMap = new Map(
      users
        .map((user) => serializeInvoiceCreator(user))
        .filter((user): user is InvoiceCreatorInfo => user !== null)
        .map((user) => [user.id, user] as const)
    );

    return rows.map((row) => ({
      ...row,
      createdBy: row.createdByUserId ? creatorMap.get(row.createdByUserId) ?? null : null,
    }));
  } catch (err) {
    console.error("attachInvoiceCreators failed:", err);
    return rows.map((row) => ({ ...row, createdBy: null }));
  }
}
