"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ProductMetaTypeLine } from "@/components/products/PhoneConditionBadge";
import { ClearableInput, FilterSelect } from "@/components/ui/FilterControls";
import { CellEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { formatPriceRangeLabel, type PriceRangeSummary } from "@/lib/phone-serial-pricing";
import { formatAmountExact } from "@/lib/utils";

interface AccessoryPurchaseLine {
  id: string;
  source: string;
  sourceLabel: string;
  date: string;
  documentNumber: string;
  detailUrl: string;
  supplierName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  retailPrice: number;
}

interface PhoneSerialLine {
  id: string;
  imei: string | null;
  serialNumber: string | null;
  cycleIndex: number | null;
  unitPrice: number;
  retailPrice: number;
  status: string;
  statusLabel: string;
  date: string;
  documentNumber: string;
  detailUrl: string;
  supplierName: string | null;
  sourceLabel: string;
}

interface ProductPurchaseHistory {
  productId: string;
  productName: string;
  brand: string;
  productType: string;
  deviceCondition?: string | null;
  view: "phone_serials" | "purchase_lines";
  currentPurchasePrice: number;
  currentRetailPrice: number;
  purchasePriceRange?: PriceRangeSummary | null;
  retailPriceRange?: PriceRangeSummary | null;
  entryCount: number;
  accessoryLines: AccessoryPurchaseLine[];
  phoneSerials: PhoneSerialLine[];
}

interface ProductPurchasePriceModalProps {
  open: boolean;
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  phone: "موبايل",
  accessory: "إكسسوار",
  spare_part: "قطعة غيار",
  smartwatch: "ساعة",
  tablet: "تابلت",
  laptop: "لابتوب",
};

const serialStatusClass: Record<string, string> = {
  available: "status-complete",
  sold: "px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20",
  removed:
    "px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20",
};

const IMEI_TOKEN_PATTERN = /\d{15}/g;

function extractImeisFromLabel(imei: string | null | undefined): string[] {
  if (!imei || imei === "—") return [];
  const matches = imei.match(IMEI_TOKEN_PATTERN);
  return matches ? [...new Set(matches)] : [];
}

function purchaseRowMatchesImeiQuery(row: PhoneSerialLine, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const imeis = extractImeisFromLabel(row.imei);
  if (imeis.length === 0) return row.imei?.includes(q) ?? false;
  return imeis.some((imei) => imei === q || imei.includes(q) || q.includes(imei));
}

function purchaseRowHasImei(row: PhoneSerialLine, imei: string): boolean {
  if (!imei) return true;
  return extractImeisFromLabel(row.imei).includes(imei);
}

function PriceSummaryCard({
  label,
  displayValue,
  accent,
}: {
  label: string;
  displayValue: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background-input/20 px-3 py-2.5">
      <p className="text-[11px] text-muted mb-1">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${accent}`}>{displayValue}</p>
    </div>
  );
}

function formatSummaryPrice(
  range: PriceRangeSummary | null | undefined,
  fallback: number
): string {
  if (range) return `${formatPriceRangeLabel(range)} ج.م`;
  return `${formatAmountExact(fallback)} ج.م`;
}

export default function ProductPurchasePriceModal({
  open,
  productId,
  productName,
  onClose,
}: ProductPurchasePriceModalProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ProductPurchaseHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseImeiFilter, setPurchaseImeiFilter] = useState("");
  const [purchaseImeiScan, setPurchaseImeiScan] = useState("");

  useEffect(() => {
    if (!open) {
      setPurchaseImeiFilter("");
      setPurchaseImeiScan("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !productId) {
      setHistory(null);
      setError(null);
      setPurchaseImeiFilter("");
      setPurchaseImeiScan("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiJson<{ history: ProductPurchaseHistory }>(`/api/inventory/${productId}/purchase-history`)
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.history) {
          setHistory(data.history);
        } else {
          setHistory(null);
          setError("تعذر تحميل تقرير أسعار الشراء");
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory(null);
        setError("تعذر تحميل تقرير أسعار الشراء");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const purchaseImeiOptions = useMemo(() => {
    if (!history || history.view !== "phone_serials") return [];
    const imeis = new Set<string>();
    for (const row of history.phoneSerials) {
      for (const imei of extractImeisFromLabel(row.imei)) {
        imeis.add(imei);
      }
    }
    return Array.from(imeis).sort((a, b) => a.localeCompare(b, "ar"));
  }, [history]);

  const displayedPhoneRows = useMemo(() => {
    if (!history || history.view !== "phone_serials") return [];
    let rows = history.phoneSerials;
    if (purchaseImeiScan.trim()) {
      rows = rows.filter((row) => purchaseRowMatchesImeiQuery(row, purchaseImeiScan));
    } else if (purchaseImeiFilter) {
      rows = rows.filter((row) => purchaseRowHasImei(row, purchaseImeiFilter));
    }
    return rows;
  }, [history, purchaseImeiFilter, purchaseImeiScan]);

  const hasImeiFilter = !!(purchaseImeiFilter || purchaseImeiScan.trim());

  const title = history?.productName || productName || "أسعار الشراء";
  const isPhoneView = history?.view === "phone_serials";
  const invoiceCountLabel = hasImeiFilter && history
    ? `${displayedPhoneRows.length} من ${history.entryCount}`
    : history
      ? formatAmountExact(history.entryCount)
      : "0";

  return (
    <Modal open={open} onClose={onClose} title={`سعر الشراء — ${title}`} size="lg">
      {loading ? (
        <p className="text-sm text-muted text-center py-8">جاري التحميل...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-8">{error}</p>
      ) : history ? (
        <div className="space-y-4 pb-1">
          <div className="rounded-xl border border-border/60 bg-background-input/30 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-bold text-white">{history.productName}</p>
              <ProductMetaTypeLine
                brand={history.brand}
                type={history.productType}
                typeLabel={typeLabels[history.productType] || history.productType}
                deviceCondition={history.deviceCondition}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <PriceSummaryCard
                label="عدد الفواتير"
                displayValue={invoiceCountLabel}
                accent="text-white"
              />
              <PriceSummaryCard
                label={isPhoneView ? "سعر الشراء" : "متوسط/سعر الشراء الحالي"}
                displayValue={formatSummaryPrice(history.purchasePriceRange, history.currentPurchasePrice)}
                accent="text-primary-light"
              />
              <PriceSummaryCard
                label={isPhoneView ? "سعر البيع" : "سعر البيع الحالي"}
                displayValue={formatSummaryPrice(history.retailPriceRange, history.currentRetailPrice)}
                accent="text-accent-green"
              />
            </div>
          </div>

          {history.entryCount === 0 ? (
            <p className="text-sm text-muted text-center py-8">لا توجد فواتير شراء مسجلة لهذا الصنف</p>
          ) : history.view === "phone_serials" ? (
            <div className="product-movement-table-wrap rounded-xl border overflow-hidden flex flex-col h-[min(50dvh,420px)] min-h-[240px]">
              <div className="product-movement-table-wrap__hint px-4 py-2.5 border-b flex-shrink-0 space-y-2.5">
                <p className="text-xs">
                  فواتير الشراء والرصيد الافتتاحي — بند لكل مستند (IMEI مجمّع كما في عرض الحركة)
                </p>
                {purchaseImeiOptions.length > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <FilterSelect
                      value={purchaseImeiFilter}
                      onChange={(value) => {
                        setPurchaseImeiFilter(value);
                        setPurchaseImeiScan("");
                      }}
                      onClear={() => setPurchaseImeiFilter("")}
                      className="sm:max-w-[220px]"
                    >
                      <option value="">كل IMEI</option>
                      {purchaseImeiOptions.map((imei) => (
                        <option key={imei} value={imei}>
                          {imei}
                        </option>
                      ))}
                    </FilterSelect>
                    <ClearableInput
                      value={purchaseImeiScan}
                      onChange={(value) => {
                        setPurchaseImeiScan(value);
                        setPurchaseImeiFilter("");
                      }}
                      onClear={() => setPurchaseImeiScan("")}
                      placeholder="امسح أو اكتب IMEI للفلترة المباشرة"
                      className="flex-1 min-w-0"
                    />
                  </div>
                ) : null}
              </div>
              <div className="overflow-auto flex-1 min-h-0 overscroll-contain product-movement-table-scroll">
                <table className="product-movement-table w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-xs border-b">
                      <th className="text-right p-3 font-semibold">IMEI</th>
                      <th className="text-right p-3 font-semibold">Serial</th>
                      <th className="text-right p-3 font-semibold">الدورة</th>
                      <th className="text-right p-3 font-semibold product-purchase-unit-price-col">سعر الشراء</th>
                      <th className="text-right p-3 font-semibold">سعر البيع</th>
                      <th className="text-right p-3 font-semibold">الحالة</th>
                      <th className="text-right p-3 font-semibold">المستند</th>
                      <th className="text-right p-3 font-semibold">المورد</th>
                      <th className="text-right p-3 font-semibold">التاريخ</th>
                      <th className="text-right p-3 font-semibold">عرض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPhoneRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-sm text-muted">
                          {hasImeiFilter
                            ? "لا توجد فواتير مطابقة لـ IMEI المحدد"
                            : "لا توجد فواتير شراء مسجلة لهذا الصنف"}
                        </td>
                      </tr>
                    ) : (
                      displayedPhoneRows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-3 font-mono product-movement-table__document whitespace-pre-line">
                          <CellEmoji emoji={em.imei}>{row.imei || "—"}</CellEmoji>
                        </td>
                        <td className="p-3 font-mono product-movement-table__muted whitespace-pre-line">
                          <CellEmoji emoji={em.serial}>{row.serialNumber || "—"}</CellEmoji>
                        </td>
                        <td className="p-3 tabular-nums product-movement-table__muted">
                          {row.cycleIndex ?? "—"}
                        </td>
                        <td className="p-3 font-bold tabular-nums product-purchase-unit-price-col">
                          {formatAmountExact(row.unitPrice)} ج.م
                        </td>
                        <td className="p-3 font-bold tabular-nums product-movement-table__qty-in">
                          {formatAmountExact(row.retailPrice)} ج.م
                        </td>
                        <td className="p-3">
                          <span className={serialStatusClass[row.status] || "status-pending"}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold product-movement-table__document">{row.documentNumber}</p>
                          <p className="text-[11px] product-movement-table__muted mt-0.5">{row.sourceLabel}</p>
                        </td>
                        <td className="p-3 product-movement-table__muted">{row.supplierName || "—"}</td>
                        <td className="p-3">
                          <DocumentDateTimeStack
                            value={row.date}
                            className="product-movement-table__datetime"
                          />
                        </td>
                        <td className="p-3">
                          <Link
                            href={row.detailUrl}
                            className="product-movement-table__link inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <span>{em.view}</span>
                            فتح
                          </Link>
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="product-movement-table-wrap rounded-xl border overflow-hidden flex flex-col h-[min(50dvh,420px)] min-h-[240px]">
              <div className="product-movement-table-wrap__hint px-4 py-2.5 border-b flex-shrink-0">
                <p className="text-xs">فواتير الشراء والرصيد الافتتاحي — المورد والكمية والأسعار</p>
              </div>
              <div className="overflow-auto flex-1 min-h-0 overscroll-contain product-movement-table-scroll">
                <table className="product-movement-table w-full min-w-[920px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-xs border-b">
                      <th className="text-right p-3 font-semibold">التاريخ</th>
                      <th className="text-right p-3 font-semibold">المستند</th>
                      <th className="text-right p-3 font-semibold">المورد</th>
                      <th className="text-right p-3 font-semibold product-purchase-unit-price-col">سعر القطعة</th>
                      <th className="text-right p-3 font-semibold">الكمية</th>
                      <th className="text-right p-3 font-semibold">الإجمالي</th>
                      <th className="text-right p-3 font-semibold">سعر البيع</th>
                      <th className="text-right p-3 font-semibold">عرض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.accessoryLines.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-3">
                          <DocumentDateTimeStack
                            value={row.date}
                            className="product-movement-table__datetime"
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-semibold product-movement-table__document">{row.documentNumber}</p>
                          <p className="text-[11px] product-movement-table__muted mt-0.5">{row.sourceLabel}</p>
                        </td>
                        <td className="p-3 product-movement-table__muted">{row.supplierName || "—"}</td>
                        <td className="p-3 font-bold tabular-nums product-purchase-unit-price-col">
                          {formatAmountExact(row.unitPrice)} ج.م
                        </td>
                        <td className="p-3 font-bold tabular-nums text-white">{row.quantity}</td>
                        <td className="p-3 font-bold tabular-nums product-movement-table__qty-in">
                          {formatAmountExact(row.lineTotal)} ج.م
                        </td>
                        <td className="p-3 font-bold tabular-nums product-movement-table__document">
                          {formatAmountExact(row.retailPrice)} ج.م
                        </td>
                        <td className="p-3">
                          <Link
                            href={row.detailUrl}
                            className="product-movement-table__link inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <span>{em.view}</span>
                            فتح
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
