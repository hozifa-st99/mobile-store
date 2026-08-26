"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import StocktakeLinesTable from "@/components/stocktake/StocktakeLinesTable";
import StocktakeTableFilters from "@/components/stocktake/StocktakeTableFilters";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { apiJson } from "@/lib/api-client";
import { resolveSavedStocktakeSerials } from "@/lib/stocktake-serial-snapshot";
import type { StocktakeLine, StocktakeSerialLine } from "@/lib/stocktake-line-types";
import {
  applyStocktakeLineFilters,
  buildPhoneGroupDetails,
  formatStocktakeAdjustmentAmount,
  recomputePhoneLineFromSerials,
  sumStocktakeAdjustmentAmount,
} from "@/lib/stocktake-line-utils";

interface StocktakeDetail {
  id: string;
  documentNumber: string;
  stocktakeDate: string;
  mode: string;
  notes: string | null;
  totalSystemQty: number;
  totalCountedQty: number;
  totalVariance: number;
  userName: string | null;
  items: Array<{
    id: string;
    productId: string;
    description: string;
    barcode: string | null;
    imeis: string[];
    serialsSnapshot?: string | null;
    serials: StocktakeSerialLine[];
    systemQuantity: number;
    countedQuantity: number;
    variance: number;
    unitCost: number;
    product: {
      type: string;
      nameAr: string;
      brand: string;
      phoneModelId: string | null;
      color: string | null;
      storage: string | null;
      ram: string | null;
      deviceCondition: string;
      boxCondition: string | null;
      batteryPercent: number | null;
    } | null;
  }>;
}

export default function StocktakeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [stocktake, setStocktake] = useState<StocktakeDetail | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    void apiJson<{ stocktake: StocktakeDetail }>(`/api/stocktakes/${id}`).then(({ ok, data }) => {
      if (ok && data.stocktake) setStocktake(data.stocktake);
      setLoading(false);
    });
  }, [id]);

  const lines: StocktakeLine[] = useMemo(() => {
    if (!stocktake) return [];

    const rawLines: StocktakeLine[] = stocktake.items.map((item) => {
      const isPhone = item.product?.type === "phone";
      const displayName = item.description.split("\n")[0] || item.description;
      const serials = isPhone
        ? resolveSavedStocktakeSerials(item.productId, {
            serials: item.serials,
            serialsSnapshot: item.serialsSnapshot,
          })
        : [];

      const line: StocktakeLine = {
        lineId: item.productId,
        productId: item.productId,
        productIds: [item.productId],
        name: item.product?.nameAr ?? displayName,
        brand: item.product?.brand ?? "",
        productType: item.product?.type ?? "",
        barcode: item.barcode,
        imeis: serials.length > 0 ? serials.flatMap((serial) => serial.imeis ?? []) : item.imeis,
        serials,
        details: isPhone
          ? buildPhoneGroupDetails(displayName, serials.length > 0 ? serials.length : item.systemQuantity)
          : item.description,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity,
        variance: item.variance,
        unitCost: item.unitCost,
      };

      return isPhone && serials.length > 0 ? recomputePhoneLineFromSerials(line) : line;
    });

    return rawLines;
  }, [stocktake]);

  const filteredLines = useMemo(
    () => applyStocktakeLineFilters(lines, { search: tableSearch }),
    [lines, tableSearch]
  );

  const totalAdjustmentAmount = useMemo(
    () => sumStocktakeAdjustmentAmount(lines),
    [lines]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!stocktake) {
    return (
      <div className="glass-card p-8 text-center text-muted">
        <p>مستند الجرد غير موجود</p>
        <Link
          href="/dashboard/inventory/stocktake"
          className="text-primary-light text-sm mt-3 inline-block hover:underline"
        >
          رجوع
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/inventory/stocktake"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <span className="text-lg leading-none">➡️</span>
          رجوع للجرد
        </Link>
      </div>

      <PageHeader
        title={`مستند جرد ${stocktake.documentNumber}`}
        subtitle={stocktake.mode === "full" ? "جرد كلي" : "جرد جزئي"}
      />

      <div className="glass-card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted mb-1">التاريخ</p>
          <DocumentDateTimeStack value={stocktake.stocktakeDate} />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">المستخدم</p>
          <p className="font-semibold text-white">{stocktake.userName || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">إجمالي التسوية</p>
          <p
            className={`font-bold tabular-nums ${
              stocktake.totalVariance === 0
                ? "text-muted"
                : stocktake.totalVariance > 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}
          >
            {stocktake.totalVariance > 0 ? `+${stocktake.totalVariance}` : stocktake.totalVariance}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">إجمالي مبلغ التسوية</p>
          <p
            className={`font-bold tabular-nums ${
              totalAdjustmentAmount === 0
                ? "text-muted"
                : totalAdjustmentAmount > 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}
          >
            {formatStocktakeAdjustmentAmount(totalAdjustmentAmount)} ج.م
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">الكمية (نظام ← فعلي)</p>
          <p className="font-bold tabular-nums text-white">
            {stocktake.totalSystemQty} ← {stocktake.totalCountedQty}
          </p>
        </div>
      </div>

      {stocktake.notes ? (
        <div className="glass-card p-4 mb-5 text-sm text-muted">{stocktake.notes}</div>
      ) : null}

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white">بنود الجرد ({lines.length})</h3>
            {tableSearch.trim() ? (
              <p className="text-xs text-muted">
                {filteredLines.length} من {lines.length} صنف
              </p>
            ) : null}
          </div>
          <StocktakeTableFilters
            search={tableSearch}
            onSearchChange={setTableSearch}
            typeFilter="all"
            onTypeFilterChange={() => {}}
            subFilter=""
            onSubFilterChange={() => {}}
            phoneBrandOptions={[]}
            categoryOptions={[]}
            onClear={() => setTableSearch("")}
            showClear={!!tableSearch.trim()}
            showTypeFilters={false}
          />
        </div>
        <div className="product-movement-table-wrap overflow-auto max-h-[min(60dvh,620px)] p-1">
          {filteredLines.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">لا توجد بنود مطابقة للبحث</p>
          ) : (
            <StocktakeLinesTable lines={filteredLines} readOnly />
          )}
        </div>
      </div>
    </>
  );
}
