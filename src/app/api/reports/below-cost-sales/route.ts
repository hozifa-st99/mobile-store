import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import { resolveReportRange } from "@/lib/report-dates";
import { buildBelowCostSalesReport } from "@/lib/below-cost-sales-report";

/** تقرير عرض فقط — معادلة منفصلة عن صافي الربح والتقرير الرئيسي */
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const range = resolveReportRange({
    period: searchParams.get("period"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    month: searchParams.get("month"),
  });

  const from = new Date(range.from);
  const to = new Date(range.to);

  const [saleItems, returnItems] = await Promise.all([
    prisma.saleItem.findMany({
      where: {
        sale: {
          branchId: auth.branchId,
          status: "completed",
          saleDate: { gte: from, lte: to },
        },
      },
      select: {
        id: true,
        description: true,
        quantity: true,
        unitPrice: true,
        unitCost: true,
        productId: true,
        product: { select: { type: true } },
        sale: {
          select: {
            subtotal: true,
            discount: true,
            invoiceNumber: true,
            saleDate: true,
          },
        },
      },
    }),
    prisma.saleReturnItem.findMany({
      where: {
        saleReturn: {
          branchId: auth.branchId,
          returnDate: { gte: from, lte: to },
        },
      },
      include: {
        saleItem: {
          include: {
            product: { select: { type: true } },
            sale: {
              select: {
                subtotal: true,
                discount: true,
                invoiceNumber: true,
                saleDate: true,
              },
            },
          },
        },
        saleReturn: {
          select: {
            returnNumber: true,
            returnDate: true,
          },
        },
      },
    }),
  ]);

  const report = buildBelowCostSalesReport(
    saleItems.map((row) => ({
      id: row.id,
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      unitCost: row.unitCost,
      productId: row.productId,
      productType: row.product?.type ?? null,
      saleSubtotal: row.sale.subtotal,
      saleDiscount: row.sale.discount,
      invoiceNumber: row.sale.invoiceNumber,
      saleDate: row.sale.saleDate,
    })),
    returnItems.map((row) => ({
      id: row.id,
      quantity: row.quantity,
      saleItem: {
        description: row.saleItem.description,
        unitPrice: row.saleItem.unitPrice,
        unitCost: row.saleItem.unitCost,
        productId: row.saleItem.productId,
        productType: row.saleItem.product?.type ?? null,
        saleSubtotal: row.saleItem.sale.subtotal,
        saleDiscount: row.saleItem.sale.discount,
        invoiceNumber: row.saleItem.sale.invoiceNumber,
        saleDate: row.saleItem.sale.saleDate,
      },
      returnInvoiceNumber: row.saleReturn.returnNumber,
      returnDate: row.saleReturn.returnDate,
    }))
  );

  return NextResponse.json({
    range: { label: range.label },
    summary: {
      totalLoss: report.totalLoss,
      saleLineCount: report.saleLineCount,
      returnLineCount: report.returnLineCount,
      segments: report.segments,
    },
    details: report.details,
  });
}