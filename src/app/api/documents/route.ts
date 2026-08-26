import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";

import { compareNewestDocumentFirst } from "@/lib/document-list-sort";
import { sumSavedStocktakeItemAdjustmentAmount } from "@/lib/stocktake-saved-adjustment";

export type DocumentType =
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sale_return"
  | "stock_entry"
  | "stocktake";

export interface UnifiedDocumentRow {
  id: string;
  type: DocumentType;
  typeLabel: string;
  documentNumber: string;
  date: string;
  createdAt: string;
  partyName: string;
  total: number;
  status: string | null;
  parentDocumentNumber: string | null;
  detailUrl: string;
}

const TYPE_LABELS: Record<DocumentType, string> = {
  purchase: "فاتورة مشتريات",
  purchase_return: "مرتجع مشتريات",
  sale: "فاتورة مبيعات",
  sale_return: "مرتجع مبيعات",
  stock_entry: "إدخال رصيد / بضاعة موجودة",
  stocktake: "تسوية / جرد",
};

function buildDateRange(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
}

function matchesTypeFilter(filter: string | undefined, value: DocumentType): boolean {
  if (!filter || filter === "all") return true;
  return filter === value;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const documentNumber = searchParams.get("documentNumber")?.trim();
  const typeFilter = searchParams.get("type")?.trim();
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 300));

  const dateRange = buildDateRange(dateFrom, dateTo);
  const numberFilter = documentNumber ? { contains: documentNumber } : undefined;

  const rows: UnifiedDocumentRow[] = [];

  const tasks: Promise<void>[] = [];

  if (matchesTypeFilter(typeFilter, "purchase")) {
    tasks.push(
      prisma.purchase
        .findMany({
          where: {
            branchId: auth.branchId,
            ...(numberFilter ? { invoiceNumber: numberFilter } : {}),
            ...(dateRange ? { purchaseDate: dateRange } : {}),
          },
          include: { supplier: { select: { nameAr: true } } },
          orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
        .then((items) => {
          for (const p of items) {
            rows.push({
              id: p.id,
              type: "purchase",
              typeLabel: TYPE_LABELS.purchase,
              documentNumber: p.invoiceNumber,
              date: p.purchaseDate.toISOString(),
              createdAt: p.createdAt.toISOString(),
              partyName: p.supplier.nameAr,
              total: p.total,
              status: p.status,
              parentDocumentNumber: null,
              detailUrl: `/dashboard/purchases/${p.id}`,
            });
          }
        })
    );
  }

  if (matchesTypeFilter(typeFilter, "purchase_return")) {
    tasks.push(
      prisma.purchaseReturn
        .findMany({
          where: {
            branchId: auth.branchId,
            ...(numberFilter ? { returnNumber: numberFilter } : {}),
            ...(dateRange ? { returnDate: dateRange } : {}),
          },
          include: {
            purchase: {
              select: {
                id: true,
                invoiceNumber: true,
                supplier: { select: { nameAr: true } },
              },
            },
          },
          orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
        .then((items) => {
          for (const r of items) {
            rows.push({
              id: r.id,
              type: "purchase_return",
              typeLabel: TYPE_LABELS.purchase_return,
              documentNumber: r.returnNumber,
              date: r.returnDate.toISOString(),
              createdAt: r.createdAt.toISOString(),
              partyName: r.purchase.supplier.nameAr,
              total: r.total,
              status: null,
              parentDocumentNumber: r.purchase.invoiceNumber,
              detailUrl: `/dashboard/purchases/${r.purchase.id}`,
            });
          }
        })
    );
  }

  if (matchesTypeFilter(typeFilter, "sale")) {
    tasks.push(
      prisma.sale
        .findMany({
          where: {
            branchId: auth.branchId,
            ...(numberFilter ? { invoiceNumber: numberFilter } : {}),
            ...(dateRange ? { saleDate: dateRange } : {}),
          },
          include: { customer: { select: { nameAr: true } } },
          orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
        .then((items) => {
          for (const s of items) {
            rows.push({
              id: s.id,
              type: "sale",
              typeLabel: TYPE_LABELS.sale,
              documentNumber: s.invoiceNumber,
              date: s.saleDate.toISOString(),
              createdAt: s.createdAt.toISOString(),
              partyName: s.customer?.nameAr || "عميل نقدي",
              total: s.total,
              status: s.status,
              parentDocumentNumber: null,
              detailUrl: `/dashboard/sales/${s.id}`,
            });
          }
        })
    );
  }

  if (matchesTypeFilter(typeFilter, "sale_return")) {
    tasks.push(
      prisma.saleReturn
        .findMany({
          where: {
            branchId: auth.branchId,
            ...(numberFilter ? { returnNumber: numberFilter } : {}),
            ...(dateRange ? { returnDate: dateRange } : {}),
          },
          include: {
            sale: {
              select: {
                id: true,
                invoiceNumber: true,
                customer: { select: { nameAr: true } },
              },
            },
          },
          orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
        .then((items) => {
          for (const r of items) {
            rows.push({
              id: r.id,
              type: "sale_return",
              typeLabel: TYPE_LABELS.sale_return,
              documentNumber: r.returnNumber,
              date: r.returnDate.toISOString(),
              createdAt: r.createdAt.toISOString(),
              partyName: r.sale.customer?.nameAr || "عميل نقدي",
              total: r.total,
              status: null,
              parentDocumentNumber: r.sale.invoiceNumber,
              detailUrl: `/dashboard/sales/${r.sale.id}`,
            });
          }
        })
    );
  }

  if (matchesTypeFilter(typeFilter, "stock_entry")) {
    tasks.push(
      prisma.stockEntry
        .findMany({
          where: {
            branchId: auth.branchId,
            ...(numberFilter ? { documentNumber: numberFilter } : {}),
            ...(dateRange ? { entryDate: dateRange } : {}),
          },
          orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
          take: limit,
        })
        .then((items) => {
          for (const entry of items) {
            rows.push({
              id: entry.id,
              type: "stock_entry",
              typeLabel: TYPE_LABELS.stock_entry,
              documentNumber: entry.documentNumber,
              date: entry.entryDate.toISOString(),
              createdAt: entry.createdAt.toISOString(),
              partyName: "رصيد افتتاحي",
              total: entry.total,
              status: entry.status,
              parentDocumentNumber: null,
              detailUrl: `/dashboard/stock-entries/${entry.id}`,
            });
          }
        })
    );
  }

  if (matchesTypeFilter(typeFilter, "stocktake")) {
    tasks.push(
      (async () => {
        try {
          const items = await prisma.stocktake.findMany({
            where: {
              branchId: auth.branchId,
              ...(numberFilter ? { documentNumber: numberFilter } : {}),
              ...(dateRange ? { stocktakeDate: dateRange } : {}),
            },
            include: {
              user: { select: { fullNameAr: true, username: true } },
              items: {
                select: { variance: true, unitCost: true, serialsSnapshot: true },
              },
            },
            orderBy: [{ stocktakeDate: "desc" }, { createdAt: "desc" }],
            take: limit,
          });

          for (const stocktake of items) {
            const modeLabel = stocktake.mode === "full" ? "جرد كلي" : "جرد جزئي";
            const userName = stocktake.user?.fullNameAr || stocktake.user?.username;
            const total = sumSavedStocktakeItemAdjustmentAmount(stocktake.items);

            rows.push({
              id: stocktake.id,
              type: "stocktake",
              typeLabel: TYPE_LABELS.stocktake,
              documentNumber: stocktake.documentNumber,
              date: stocktake.stocktakeDate.toISOString(),
              createdAt: stocktake.createdAt.toISOString(),
              partyName: userName ? `${modeLabel} — ${userName}` : modeLabel,
              total,
              status: stocktake.status,
              parentDocumentNumber: null,
              detailUrl: `/dashboard/inventory/stocktake/${stocktake.id}`,
            });
          }
        } catch {
          const items = await prisma.$queryRaw<
            {
              id: string;
              document_number: string;
              stocktake_date: string;
              created_at: string;
              mode: string;
              status: string;
            }[]
          >`
            SELECT id, document_number, stocktake_date, created_at, mode, status
            FROM stocktakes
            WHERE branch_id = ${auth.branchId}
            ORDER BY stocktake_date DESC, created_at DESC
            LIMIT ${limit}
          `;

          for (const stocktake of items) {
            const modeLabel = stocktake.mode === "full" ? "جرد كلي" : "جرد جزئي";
            rows.push({
              id: stocktake.id,
              type: "stocktake",
              typeLabel: TYPE_LABELS.stocktake,
              documentNumber: stocktake.document_number,
              date: new Date(stocktake.stocktake_date).toISOString(),
              createdAt: new Date(stocktake.created_at).toISOString(),
              partyName: modeLabel,
              total: 0,
              status: stocktake.status,
              parentDocumentNumber: null,
              detailUrl: `/dashboard/inventory/stocktake/${stocktake.id}`,
            });
          }
        }
      })()
    );
  }

  await Promise.all(tasks);

  rows.sort((a, b) =>
    compareNewestDocumentFirst(a.date, a.createdAt, b.date, b.createdAt)
  );

  const documents = rows.slice(0, limit);

  return NextResponse.json({ documents, total: documents.length });
}
