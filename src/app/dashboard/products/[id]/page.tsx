"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import { PhoneConditionBadge } from "@/components/products/PhoneConditionBadge";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { apiJson } from "@/lib/api-client";
import type {
  ProductInvoiceRow,
  ProductRetailPriceHistory,
  RetailPriceChangeRow,
} from "@/lib/retail-price-history-types";
import { formatPriceRangeLabel } from "@/lib/phone-serial-pricing";
import type { PriceRangeSummary } from "@/lib/phone-serial-pricing";
import { toast } from "@/lib/toast";
import { formatAmountExact, formatCurrency } from "@/lib/utils";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";

const typeLabels: Record<string, string> = {
  phone: "موبايل",
  accessory: "إكسسوار",
  spare_part: "قطعة غيار",
  smartwatch: "ساعة ذكية",
  tablet: "تابلت",
  laptop: "لابتوب",
};

interface PhoneSerialRow {
  id: string;
  imeis?: string[];
  imei: string | null;
  barcode: string | null;
  cycleIndex?: number;
  purchasePrice: number;
  retailPrice: number;
}

function formatSerialImeis(serial: PhoneSerialRow): string {
  if (serial.imeis?.length) {
    return serial.imeis.length === 1 ? serial.imeis[0] : serial.imeis.join(" · ");
  }
  return serial.imei ?? "—";
}

function serialMatchesImeiQuery(serial: PhoneSerialRow, query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  const imeis = serial.imeis?.length ? serial.imeis : serial.imei ? [serial.imei] : [];
  return imeis.some((imei) => imei === q || imei.includes(q) || q.includes(imei));
}

function invoiceMatchesImeiQuery(row: ProductInvoiceRow, query: string): boolean {
  const q = query.trim();
  if (!q || !row.imei) return false;
  const label = formatStoredDeviceImeis(row.imei);
  return row.imei.includes(q) || label.includes(q) || q.includes(row.imei);
}

interface ProductData {
  nameAr: string;
  brand: string;
  type: string;
  deviceCondition?: string | null;
  quantity: number;
  availableQuantity: number;
  purchasePrice: number;
  retailPrice: number;
  purchasePriceRange?: PriceRangeSummary | null;
  retailPriceRange?: PriceRangeSummary | null;
  phoneSerials: PhoneSerialRow[];
}

type InvoiceFilter = "purchase" | "sale" | "all";

function matchesInvoiceFilter(row: ProductInvoiceRow, filter: InvoiceFilter) {
  if (filter === "all") return true;
  if (filter === "sale") return row.type === "sale";
  return row.type === "purchase" || row.type === "stock_entry";
}

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [retailPrice, setRetailPrice] = useState(0);
  const [serialPrices, setSerialPrices] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<ProductRetailPriceHistory | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("purchase");
  const [invoiceImeiFilter, setInvoiceImeiFilter] = useState("");
  const [invoiceImeiScan, setInvoiceImeiScan] = useState("");
  const [imeiHistoryFilter, setImeiHistoryFilter] = useState("all");
  const [selectedSerialId, setSelectedSerialId] = useState("");
  const [serialScanQuery, setSerialScanQuery] = useState("");
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isPhone = product?.type === "phone";

  const filteredInvoices = useMemo(() => {
    if (!history) return [];
    return history.invoices.filter((row) => matchesInvoiceFilter(row, invoiceFilter));
  }, [history, invoiceFilter]);

  const invoiceImeiOptions = useMemo(() => {
    if (!isPhone) return [];
    const labels = new Set<string>();
    for (const row of filteredInvoices) {
      if (!row.imei) continue;
      labels.add(formatStoredDeviceImeis(row.imei));
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b, "ar"));
  }, [filteredInvoices, isPhone]);

  const displayedInvoices = useMemo(() => {
    let rows = filteredInvoices;
    if (invoiceImeiFilter) {
      rows = rows.filter(
        (row) => row.imei && formatStoredDeviceImeis(row.imei) === invoiceImeiFilter
      );
    }
    if (invoiceImeiScan.trim()) {
      rows = rows.filter((row) => invoiceMatchesImeiQuery(row, invoiceImeiScan));
    }
    return rows;
  }, [filteredInvoices, invoiceImeiFilter, invoiceImeiScan]);

  const visiblePhoneSerials = useMemo(() => {
    if (!product || !isPhone) return [];
    let rows = product.phoneSerials;

    if (serialScanQuery.trim()) {
      rows = rows.filter((serial) => serialMatchesImeiQuery(serial, serialScanQuery));
    } else if (selectedSerialId) {
      rows = rows.filter((serial) => serial.id === selectedSerialId);
    }

    return rows;
  }, [product, isPhone, selectedSerialId, serialScanQuery]);

  const invoiceEmptyText = useMemo(() => {
    if (!history || history.invoices.length === 0) {
      return "لا توجد فواتير مرتبطة بهذا الصنف";
    }
    if (invoiceFilter === "purchase") return "لا توجد مشتريات أو أرصدة افتتاح لهذا الصنف";
    if (invoiceFilter === "sale") return "لا توجد فواتير مبيعات لهذا الصنف";
    if (invoiceImeiFilter || invoiceImeiScan.trim()) {
      return "لا توجد فواتير مطابقة لـ IMEI المحدد";
    }
    return "لا توجد فواتير مرتبطة بهذا الصنف";
  }, [history, invoiceFilter, invoiceImeiFilter, invoiceImeiScan]);

  const priceChanged = useMemo(() => {
    if (!product) return false;
    if (isPhone) {
      return product.phoneSerials.some((serial) => {
        const next = serialPrices[serial.id];
        return next != null && Math.abs(next - serial.retailPrice) > 0.001;
      });
    }
    return Math.abs(retailPrice - product.retailPrice) > 0.001;
  }, [product, retailPrice, serialPrices, isPhone]);

  const priceTooLow = useMemo(() => {
    if (!product) return false;
    if (isPhone) {
      return product.phoneSerials.some((serial) => {
        const next = serialPrices[serial.id] ?? serial.retailPrice;
        return next < serial.purchasePrice - 0.001;
      });
    }
    return retailPrice < product.purchasePrice - 0.001;
  }, [product, retailPrice, serialPrices, isPhone]);

  const imeiChangeGroups = useMemo(() => {
    if (!history || !isPhone) return [];
    const grouped = new Map<string, RetailPriceChangeRow[]>();

    for (const change of history.changes) {
      const key = change.imei ? formatStoredDeviceImeis(change.imei) : "—";
      const list = grouped.get(key) ?? [];
      list.push(change);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries())
      .filter(([imei]) => imei !== "—")
      .map(([imei, changes]) => ({ imei, changes }))
      .sort((a, b) => a.imei.localeCompare(b.imei, "ar"));
  }, [history, isPhone]);

  const visibleImeiChangeGroups = useMemo(() => {
    if (imeiHistoryFilter === "all") return imeiChangeGroups;
    return imeiChangeGroups.filter((group) => group.imei === imeiHistoryFilter);
  }, [imeiChangeGroups, imeiHistoryFilter]);

  const loadHistory = async () => {
    const { ok, data } = await apiJson<{ history: ProductRetailPriceHistory; message?: string }>(
      `/api/products/${id}/retail-price-history`
    );
    if (ok && data?.history) {
      setHistory(data.history);
    }
  };

  const loadProduct = async () => {
    const { ok, data } = await apiJson<{ product: Record<string, unknown> }>(`/api/products/${id}`);
    if (!ok || !data?.product) return null;

    const p = data.product;
    const phoneSerials = Array.isArray(p.phoneSerials)
      ? (p.phoneSerials as PhoneSerialRow[])
      : [];

    const nextProduct: ProductData = {
      nameAr: String(p.nameAr || ""),
      brand: String(p.brand || ""),
      type: String(p.type || ""),
      deviceCondition: typeof p.deviceCondition === "string" ? p.deviceCondition : null,
      quantity: Number(p.quantity || 0),
      availableQuantity: Number(p.availableQuantity ?? phoneSerials.length ?? 0),
      purchasePrice: Number(p.purchasePrice || 0),
      retailPrice: Number(p.retailPrice || 0),
      purchasePriceRange: (p.purchasePriceRange as PriceRangeSummary | null) ?? null,
      retailPriceRange: (p.retailPriceRange as PriceRangeSummary | null) ?? null,
      phoneSerials,
    };

    setProduct(nextProduct);
    setRetailPrice(nextProduct.retailPrice);
    setSerialPrices(
      Object.fromEntries(phoneSerials.map((serial) => [serial.id, serial.retailPrice]))
    );

    return nextProduct;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      await loadProduct();
      if (cancelled) return;
      await loadHistory();
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (invoiceImeiFilter && !invoiceImeiOptions.includes(invoiceImeiFilter)) {
      setInvoiceImeiFilter("");
    }
  }, [invoiceImeiFilter, invoiceImeiOptions]);

  useEffect(() => {
    if (selectedSerialId && !product?.phoneSerials.some((serial) => serial.id === selectedSerialId)) {
      setSelectedSerialId("");
    }
  }, [product, selectedSerialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (priceTooLow) {
      toast.error("سعر البيع لا يمكن أن يكون أقل من سعر الشراء");
      return;
    }

    if (priceChanged && !reason.trim()) {
      toast.error("يجب إدخال سبب أو ملاحظات عند تغيير سعر البيع");
      return;
    }

    if (!priceChanged) {
      toast.info("لم يتغير سعر البيع");
      return;
    }

    setSaving(true);

    const payload = isPhone
      ? {
          reason: reason.trim(),
          serialUpdates: product.phoneSerials
            .filter((serial) => Math.abs((serialPrices[serial.id] ?? serial.retailPrice) - serial.retailPrice) > 0.001)
            .map((serial) => ({
              serialId: serial.id,
              retailPrice: serialPrices[serial.id] ?? serial.retailPrice,
            })),
        }
      : { retailPrice, reason: reason.trim() };

    const { ok, data } = await apiJson<{ message?: string }>(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (ok) {
      toast.success("تم تحديث سعر البيع");
      setReason("");
      await loadProduct();
      await loadHistory();
    } else {
      toast.error(data?.message || "حدث خطأ");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="glass-card p-8 text-center text-muted">
        <p>المنتج غير موجود</p>
        <Link href="/dashboard/products" className="text-primary-light text-sm mt-3 inline-block hover:underline">
          رجوع للمنتجات
        </Link>
      </div>
    );
  }

  const purchasePriceLabel = isPhone
    ? `${formatPriceRangeLabel(product.purchasePriceRange ?? null, formatCurrency(product.purchasePrice))} ج.م`
    : `${formatCurrency(product.purchasePrice)} ج.م`;

  const retailPriceLabel = isPhone
    ? `${formatPriceRangeLabel(product.retailPriceRange ?? null, formatCurrency(product.retailPrice))} ج.م`
    : `${formatCurrency(product.retailPrice)} ج.م`;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="ArrowRight">
            ➡️
          </span>
          رجوع للمنتجات
        </Link>
      </div>

      <PageHeader title="تعديل سعر البيع" subtitle={product.nameAr} />

      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
          <div className="rounded-xl border border-border/50 bg-background-input/20 p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">بيانات الصنف</h3>
            <InfoRow label="اسم المنتج" value={product.nameAr} />
            <InfoRow label="الماركة" value={product.brand} />
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">النوع</span>
              <div className="flex flex-col items-end gap-1.5 text-left">
                <span className="font-semibold text-white">
                  {typeLabels[product.type] || product.type}
                </span>
                {isPhone ? <PhoneConditionBadge condition={product.deviceCondition} /> : null}
              </div>
            </div>
            <InfoRow label="سعر الشراء (التكلفة)" value={purchasePriceLabel} />
            <div className="rounded-xl border border-amber-500/30 bg-black/40 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
              <div>
                <p className="text-[11px] font-medium text-amber-400/90 mb-1">سعر البيع الحالي</p>
                <p className="text-base font-bold tabular-nums text-amber-200">{retailPriceLabel}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-amber-400/90 mb-1">الكمية</p>
                <p className="text-base font-bold tabular-nums text-amber-200">
                  {isPhone ? product.availableQuantity : product.quantity}
                </p>
              </div>
            </div>
          </div>

          {isPhone ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">أسعار البيع لكل IMEI</h3>
                <p className="text-xs text-muted mt-1">
                  عدّل سعر البيع لكل جهاز على حدة — الحد الأدنى هو تكلفة الشراء لنفس الجهاز
                </p>
              </div>

              {product.phoneSerials.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">لا توجد أجهزة متاحة لهذا الصنف</p>
              ) : (
                <>
                  <div className="flex flex-col lg:flex-row gap-2">
                    <FilterSelect
                      value={selectedSerialId}
                      onChange={(value) => {
                        setSelectedSerialId(value);
                        setSerialScanQuery("");
                      }}
                      onClear={() => setSelectedSerialId("")}
                      className="min-w-[200px]"
                    >
                      <option value="">كل الأجهزة المتاحة</option>
                      {product.phoneSerials.map((serial) => (
                        <option key={serial.id} value={serial.id}>
                          {formatSerialImeis(serial)}
                          {serial.cycleIndex ? ` · دورة ${serial.cycleIndex}` : ""}
                        </option>
                      ))}
                    </FilterSelect>
                    <ClearableInput
                      value={serialScanQuery}
                      onChange={(value) => {
                        setSerialScanQuery(value);
                        setSelectedSerialId("");
                      }}
                      onClear={() => setSerialScanQuery("")}
                      placeholder="امسح أو اكتب IMEI للفلترة المباشرة"
                      className="flex-1 min-w-0"
                    />
                  </div>

                  {visiblePhoneSerials.length === 0 ? (
                    <p className="text-sm text-muted text-center py-6">لا يوجد جهاز مطابق للاختيار</p>
                  ) : (
                <div className="product-movement-table-wrap overflow-auto rounded-xl border border-border/50">
                  <table className="product-movement-table w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="text-xs border-b">
                        <th className="text-right p-3 font-semibold">IMEI</th>
                        <th className="text-right p-3 font-semibold">الدورة</th>
                        <th className="text-right p-3 font-semibold">سعر الشراء</th>
                        <th className="text-right p-3 font-semibold">سعر البيع الحالي</th>
                        <th className="text-right p-3 font-semibold">سعر البيع الجديد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePhoneSerials.map((serial) => {
                        const nextPrice = serialPrices[serial.id] ?? serial.retailPrice;
                        const tooLow = nextPrice < serial.purchasePrice - 0.001;
                        const isHighlighted =
                          selectedSerialId === serial.id ||
                          (serialScanQuery.trim() !== "" && visiblePhoneSerials.length === 1);
                        return (
                          <tr
                            key={serial.id}
                            id={`serial-price-row-${serial.id}`}
                            className={`border-b ${isHighlighted ? "bg-primary/10" : ""}`}
                          >
                            <td className="p-3 font-semibold tabular-nums">{formatSerialImeis(serial)}</td>
                            <td className="p-3 tabular-nums text-muted">{serial.cycleIndex ?? "—"}</td>
                            <td className="p-3 tabular-nums text-muted">
                              {formatAmountExact(serial.purchasePrice)} ج.م
                            </td>
                            <td className="p-3 tabular-nums text-accent-green">
                              {formatAmountExact(serial.retailPrice)} ج.م
                            </td>
                            <td className="p-3">
                              <input
                                ref={(el) => {
                                  priceInputRefs.current[serial.id] = el;
                                }}
                                type="number"
                                min={serial.purchasePrice}
                                step="0.01"
                                value={nextPrice}
                                onChange={(e) =>
                                  setSerialPrices((prev) => ({
                                    ...prev,
                                    [serial.id]: Number(e.target.value),
                                  }))
                                }
                                className="glass-input py-2 text-sm max-w-[180px]"
                              />
                              {tooLow ? (
                                <p className="text-[11px] text-red-400 mt-1">أقل من التكلفة</p>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted mb-1.5">سعر البيع الجديد</label>
              <input
                type="number"
                min={product.purchasePrice}
                step="0.01"
                required
                value={retailPrice}
                onChange={(e) => setRetailPrice(Number(e.target.value))}
                className="glass-input"
              />
              <p className="text-[11px] text-muted mt-1.5">
                الحد الأدنى: {formatCurrency(product.purchasePrice)} ج.م (سعر الشراء)
              </p>
              {priceTooLow ? (
                <p className="text-[11px] text-red-400 mt-1">سعر البيع أقل من التكلفة</p>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1.5">
              سبب / ملاحظات {priceChanged ? <span className="text-red-400">*</span> : null}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="مثال: تعديل السوق، عرض موسمي، موازنة مع المنافسين..."
              className="glass-input min-h-[88px] resize-y"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
            <Link
              href="/dashboard/products"
              className="inline-flex justify-center px-5 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white hover:border-primary/30 transition-colors"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={
                saving ||
                priceTooLow ||
                !priceChanged ||
                (priceChanged && !reason.trim()) ||
                (isPhone && product.phoneSerials.length === 0)
              }
              className="btn-primary sm:w-auto sm:px-10 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ سعر البيع"}
            </button>
          </div>
        </form>

        {isPhone ? (
          <div className="space-y-4">
            <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">تقرير تغييرات سعر البيع</h3>
                <p className="text-xs text-muted mt-1">كل IMEI له تقرير منفصل</p>
              </div>
              {history && history.changedImeis.length > 0 ? (
                <select
                  value={imeiHistoryFilter}
                  onChange={(e) => setImeiHistoryFilter(e.target.value)}
                  className="bg-background-input border border-border rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-primary/50 min-w-[180px]"
                >
                  <option value="all">كل IMEI المتغيرة</option>
                  {history.changedImeis.map((imei) => (
                    <option key={imei} value={imei}>
                      {imei}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {visibleImeiChangeGroups.length === 0 ? (
              <HistorySection title="تقرير تغييرات سعر البيع" emptyText="لا توجد تغييرات يدوية مسجلة">
                {null}
              </HistorySection>
            ) : (
              visibleImeiChangeGroups.map((group) => (
                <HistorySection
                  key={group.imei}
                  title={`تقرير تغييرات — IMEI ${group.imei}`}
                  emptyText="لا توجد تغييرات"
                >
                  <ChangesTable changes={group.changes} />
                </HistorySection>
              ))
            )}
          </div>
        ) : (
          <HistorySection title="تقرير تغييرات سعر البيع" emptyText="لا توجد تغييرات يدوية مسجلة">
            {history && history.changes.length > 0 ? <ChangesTable changes={history.changes} /> : null}
          </HistorySection>
        )}

        <HistorySection
          title="فواتير الصنف"
          emptyText={invoiceEmptyText}
          subtitle="سعر البيع في الجدول من واقع الفاتورة الأصلية — للعرض فقط ولا يتغير عند تعديل السعر أعلاه"
          headerActions={
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end w-full sm:w-auto">
              <select
                value={invoiceFilter}
                onChange={(e) => {
                  setInvoiceFilter(e.target.value as InvoiceFilter);
                  setInvoiceImeiFilter("");
                  setInvoiceImeiScan("");
                }}
                className="bg-background-input border border-border rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-primary/50 min-w-[168px]"
              >
                <option value="all">الكل</option>
                <option value="purchase">مشتريات وأرصدة افتتاح</option>
                <option value="sale">مبيعات</option>
              </select>
              {isPhone ? (
                <>
                  <FilterSelect
                    value={invoiceImeiFilter}
                    onChange={(value) => {
                      setInvoiceImeiFilter(value);
                      setInvoiceImeiScan("");
                    }}
                    onClear={() => setInvoiceImeiFilter("")}
                    className="min-w-[180px]"
                  >
                    <option value="">كل IMEI</option>
                    {invoiceImeiOptions.map((imei) => (
                      <option key={imei} value={imei}>
                        {imei}
                      </option>
                    ))}
                  </FilterSelect>
                  <ClearableInput
                    value={invoiceImeiScan}
                    onChange={(value) => {
                      setInvoiceImeiScan(value);
                      setInvoiceImeiFilter("");
                    }}
                    onClear={() => setInvoiceImeiScan("")}
                    placeholder="فلتر IMEI مباشر..."
                    className="min-w-[160px]"
                  />
                </>
              ) : null}
            </div>
          }
        >
          {displayedInvoices.length > 0 ? (
            <table className="product-movement-table w-full min-w-[920px] text-sm">
              <thead>
                <tr className="text-xs border-b">
                  <th className="text-right p-3 font-semibold">التاريخ</th>
                  <th className="text-right p-3 font-semibold">النوع</th>
                  {isPhone ? <th className="text-right p-3 font-semibold">IMEI</th> : null}
                  <th className="text-right p-3 font-semibold">المستند</th>
                  <th className="text-right p-3 font-semibold">الطرف</th>
                  <th className="text-right p-3 font-semibold">الكمية</th>
                  <th className="text-right p-3 font-semibold">سعر الوحدة</th>
                  <th className="text-right p-3 font-semibold product-invoice-table__retail-head">
                    سعر البيع
                  </th>
                  <th className="text-right p-3 font-semibold">عرض</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvoices.map((row: ProductInvoiceRow) => (
                  <tr key={`${row.type}-${row.id}-${row.imei || ""}`} className="border-b">
                    <td className="p-3">
                      <DocumentDateTimeStack value={row.date} />
                    </td>
                    <td className="p-3 text-muted">{row.typeLabel}</td>
                    {isPhone ? (
                      <td className="p-3 font-semibold tabular-nums">
                        {row.imei ? formatStoredDeviceImeis(row.imei) : "—"}
                      </td>
                    ) : null}
                    <td className="p-3 font-semibold">{row.documentNumber}</td>
                    <td className="p-3 text-muted">{row.counterparty || "—"}</td>
                    <td className="p-3 font-bold tabular-nums">{row.quantity}</td>
                    <td className="p-3 font-bold tabular-nums">{formatAmountExact(row.unitPrice)} ج.م</td>
                    <td className="p-3 font-bold tabular-nums product-invoice-table__retail-cell">
                      {row.retailPrice != null ? `${formatAmountExact(row.retailPrice)} ج.م` : "—"}
                    </td>
                    <td className="p-3">
                      <Link
                        href={row.detailUrl}
                        className="product-movement-table__link text-xs font-semibold"
                      >
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </HistorySection>
      </div>
    </>
  );
}

function ChangesTable({ changes }: { changes: RetailPriceChangeRow[] }) {
  return (
    <table className="product-movement-table w-full min-w-[720px] text-sm">
      <thead>
        <tr className="text-xs border-b">
          <th className="text-right p-3 font-semibold">التاريخ</th>
          <th className="text-right p-3 font-semibold">من ← إلى</th>
          <th className="text-right p-3 font-semibold">المستخدم</th>
          <th className="text-right p-3 font-semibold">السبب</th>
          <th className="text-right p-3 font-semibold">أول فاتورة بعد التغيير</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((row) => (
          <tr key={row.id} className="border-b">
            <td className="p-3">
              <DocumentDateTimeStack value={row.changedAt} />
            </td>
            <td className="p-3 font-bold tabular-nums text-accent-green">
              {formatAmountExact(row.oldPrice)} ← {formatAmountExact(row.newPrice)} ج.م
            </td>
            <td className="p-3 text-muted">{row.userName || "—"}</td>
            <td className="p-3 text-white">{row.reason}</td>
            <td className="p-3">
              {row.firstSaleAfter ? (
                <div>
                  <Link
                    href={row.firstSaleAfter.detailUrl}
                    className="product-movement-table__link text-xs font-semibold"
                  >
                    {row.firstSaleAfter.invoiceNumber}
                  </Link>
                  <p className="text-[11px] text-muted mt-0.5">
                    بسعر {formatAmountExact(row.firstSaleAfter.unitPrice)} ج.م
                  </p>
                </div>
              ) : (
                <span className="text-muted text-xs">لم تُسجَّل فاتورة بعد</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-white text-left">{value}</span>
    </div>
  );
}

function ClearFilterButton({ onClick, label = "مسح" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border text-base text-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
    >
      <span aria-hidden>❌</span>
    </button>
  );
}

function ClearableInput({
  value,
  onChange,
  onClear,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`glass-input py-2 text-sm w-full ${value ? "pl-9" : ""}`}
      />
      {value ? (
        <span className="absolute left-1 top-1/2 -translate-y-1/2">
          <ClearFilterButton onClick={onClear} />
        </span>
      ) : null}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  onClear,
  className,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className ?? ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background-input border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-primary/50 min-w-0 flex-1"
      >
        {children}
      </select>
      {value ? <ClearFilterButton onClick={onClear} /> : null}
    </div>
  );
}

function HistorySection({
  title,
  emptyText,
  subtitle,
  headerActions,
  children,
}: {
  title: string;
  emptyText: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hasContent = children != null && (Array.isArray(children) ? children.some(Boolean) : true);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle ? <p className="text-xs text-muted mt-1">{subtitle}</p> : null}
        </div>
        {headerActions}
      </div>
      <div className="product-movement-table-wrap overflow-auto max-h-[min(50dvh,420px)]">
        {hasContent ? children : <p className="text-sm text-muted text-center py-10">{emptyText}</p>}
      </div>
    </div>
  );
}
