"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import { apiJson } from "@/lib/api-client";
import ReturnConfirmModal, {
  type ReturnConfirmRow,
} from "@/components/returns/ReturnConfirmModal";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { scrollElementToPageTopAfterPaint } from "@/lib/scroll-to-element";
import { computeSaleReturnPricing } from "@/lib/sale-return-pricing";

interface Customer {
  id: string;
  nameAr: string;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: string;
  total: number;
  returnStatus: string;
  customer?: { nameAr: string } | null;
}

interface ReturnableItem {
  id: string;
  description: string;
  quantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  imei: string | null;
  barcode: string | null;
  isPhone: boolean;
  canReturn: boolean;
  blockReason: string | null;
}

interface ReturnableSale {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  returnStatus: string;
  customer: { nameAr: string };
}

interface QueryFilters {
  invoiceNumber: string;
  customerId: string;
  dateFrom: string;
  dateTo: string;
}

const returnStatusMap: Record<string, { label: string; class: string }> = {
  none: { label: "—", class: "" },
  partial: { label: "مرتجع جزئي", class: "status-pending" },
  full: { label: "مرتجع كامل", class: "status-complete" },
};

function buildQuery(filters: QueryFilters): string {
  const params = new URLSearchParams();
  params.set("returnableOnly", "true");
  if (filters.invoiceNumber.trim()) params.set("invoiceNumber", filters.invoiceNumber.trim());
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return `?${params.toString()}`;
}

function RefundSummary({
  pricing,
  saleDiscount,
  saleTaxRate,
}: {
  pricing: ReturnType<typeof computeSaleReturnPricing>;
  saleDiscount: number;
  saleTaxRate: number;
}) {
  const hasSaleDiscount = saleDiscount > 0.001;
  const hasSaleTax = saleTaxRate > 0.001;

  return (
    <div className="rounded-xl border border-border/60 bg-background-input/30 p-4 space-y-3">
      <p className="text-xs font-bold text-muted">ملخص المرتجع للعميل</p>
      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            hasSaleDiscount
              ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
              : "bg-white/5 border-border text-muted"
          }`}
        >
          خصم: {hasSaleDiscount ? "نعم" : "لا"}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            hasSaleTax
              ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
              : "bg-white/5 border-border text-muted"
          }`}
        >
          ضريبة: {hasSaleTax ? `نعم (${saleTaxRate}%)` : "لا"}
        </span>
      </div>
      <div className="text-sm space-y-1">
        <div className="flex justify-between gap-4 text-muted">
          <span>مجموع الأصناف</span>
          <span className="tabular-nums text-white">{formatCurrency(pricing.subtotal)} ج.م</span>
        </div>
        {pricing.discount > 0.001 && (
          <div className="flex justify-between gap-4 text-amber-200">
            <span>خصم مُطبَّق</span>
            <span className="tabular-nums">- {formatCurrency(pricing.discount)} ج.م</span>
          </div>
        )}
        {pricing.taxAmount > 0.001 && (
          <div className="flex justify-between gap-4 text-sky-200">
            <span>ضريبة ({pricing.taxRate}%)</span>
            <span className="tabular-nums">{formatCurrency(pricing.taxAmount)} ج.م</span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-2 border-t border-border/40">
          <span className="font-bold text-white">المبلغ المُرد للعميل</span>
          <span className="font-bold text-accent-green tabular-nums">
            {formatCurrency(pricing.total)} ج.م
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SalesReturnsPage() {
  const searchParams = useSearchParams();
  const initialSaleId = searchParams.get("saleId");

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(initialSaleId);
  const [returnableSale, setReturnableSale] = useState<ReturnableSale | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [canReturnAny, setCanReturnAny] = useState(false);
  const [loadingReturnable, setLoadingReturnable] = useState(false);

  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFullReturn, setPendingFullReturn] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const activeQuery: QueryFilters = {
    invoiceNumber,
    customerId,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
  };

  const loadSales = useCallback(async (query: QueryFilters) => {
    setLoading(true);
    const { ok, data } = await apiJson<{ sales: Sale[] }>(`/api/sales${buildQuery(query)}`);
    if (ok) setSales(data.sales || []);
    setLoading(false);
  }, []);

  const loadReturnable = useCallback(async (saleId: string) => {
    setLoadingReturnable(true);
    setMessage(null);
    const { ok, data } = await apiJson<{
      sale: ReturnableSale;
      items: ReturnableItem[];
      canReturnAny: boolean;
    }>(`/api/sales/${saleId}/returnable`);
    if (ok && data) {
      setReturnableSale(data.sale);
      setReturnableItems(data.items || []);
      setCanReturnAny(data.canReturnAny);
      const initial: Record<string, number> = {};
      for (const item of data.items || []) {
        if (item.canReturn) initial[item.id] = 0;
      }
      setReturnQty(initial);
    } else {
      setReturnableSale(null);
      setReturnableItems([]);
      setCanReturnAny(false);
    }
    setLoadingReturnable(false);
  }, []);

  useEffect(() => {
    apiJson<{ customers: Customer[] }>("/api/customers").then(({ ok, data }) => {
      if (ok) setCustomers(data.customers || []);
    });
  }, []);

  useEffect(() => {
    void loadSales(activeQuery);
  }, [invoiceNumber, customerId, appliedDates.dateFrom, appliedDates.dateTo, loadSales]);

  useEffect(() => {
    if (selectedId) void loadReturnable(selectedId);
    else {
      setReturnableSale(null);
      setReturnableItems([]);
      setReturnQty({});
    }
  }, [selectedId, loadReturnable]);

  useEffect(() => {
    if (!selectedId) return;
    scrollElementToPageTopAfterPaint(detailPanelRef.current);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || loadingReturnable) return;
    scrollElementToPageTopAfterPaint(detailPanelRef.current);
  }, [selectedId, loadingReturnable]);

  useEffect(() => {
    if (initialSaleId) setSelectedId(initialSaleId);
  }, [initialSaleId]);

  const applyDateFilters = () => setAppliedDates({ dateFrom, dateTo });

  const resetFilters = () => {
    setInvoiceNumber("");
    setCustomerId("");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
    setSelectedId(null);
  };

  const hasActiveFilters = Boolean(
    invoiceNumber.trim() || customerId || appliedDates.dateFrom || appliedDates.dateTo
  );
  const hasPendingDateFilters =
    dateFrom !== appliedDates.dateFrom || dateTo !== appliedDates.dateTo;

  const returnableOnly = useMemo(
    () => returnableItems.filter((item) => item.canReturn),
    [returnableItems]
  );

  /** جزئي فقط إذا أكثر من صنف، أو صنف واحد بكمية متاحة > 1 */
  const canPartialReturn = useMemo(() => {
    if (returnableOnly.length === 0) return false;
    if (returnableOnly.length > 1) return true;
    return returnableOnly[0].returnableQuantity > 1;
  }, [returnableOnly]);

  const returnLines = useMemo(
    () =>
      returnableItems
        .filter((item) => item.canReturn && (returnQty[item.id] ?? 0) > 0)
        .map((item) => ({
          saleItemId: item.id,
          quantity: returnQty[item.id] ?? 0,
        })),
    [returnableItems, returnQty]
  );

  const returnLineSubtotal = useMemo(
    () =>
      returnableItems.reduce((s, item) => {
        const qty = returnQty[item.id] ?? 0;
        return s + qty * item.unitPrice;
      }, 0),
    [returnableItems, returnQty]
  );

  const fullReturnLineSubtotal = useMemo(
    () =>
      returnableItems.reduce(
        (s, item) =>
          item.canReturn ? s + item.returnableQuantity * item.unitPrice : s,
        0
      ),
    [returnableItems]
  );

  const partialReturnPricing = useMemo(() => {
    if (!returnableSale) {
      return { subtotal: 0, discount: 0, taxRate: 0, taxAmount: 0, total: 0 };
    }
    return computeSaleReturnPricing({
      saleSubtotal: returnableSale.subtotal,
      saleDiscount: returnableSale.discount,
      saleTaxRate: returnableSale.taxRate,
      returnLineSubtotal,
    });
  }, [returnableSale, returnLineSubtotal]);

  const fullReturnPricing = useMemo(() => {
    if (!returnableSale) {
      return { subtotal: 0, discount: 0, taxRate: 0, taxAmount: 0, total: 0 };
    }
    return computeSaleReturnPricing({
      saleSubtotal: returnableSale.subtotal,
      saleDiscount: returnableSale.discount,
      saleTaxRate: returnableSale.taxRate,
      returnLineSubtotal: fullReturnLineSubtotal,
    });
  }, [returnableSale, fullReturnLineSubtotal]);

  const setItemQty = (itemId: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, qty));
    setReturnQty((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const selectFullReturn = () => {
    const next: Record<string, number> = {};
    for (const item of returnableItems) {
      if (item.canReturn) next[item.id] = item.returnableQuantity;
    }
    setReturnQty(next);
  };

  const closeInvoicePanel = () => {
    setSelectedId(null);
    setReturnableSale(null);
    setReturnableItems([]);
    setReturnQty({});
    setNotes("");
  };

  const openReturnConfirm = (fullReturn: boolean) => {
    if (!selectedId || !returnableSale) return;

    if (!fullReturn && returnLines.length === 0) {
      setMessage({ type: "err", text: "اختر أصنافاً للإرجاع أو استخدم مرتجع كامل" });
      return;
    }

    setPendingFullReturn(fullReturn);
    setConfirmOpen(true);
  };

  const executeReturn = async () => {
    if (!selectedId || !returnableSale) return;

    const fullReturn = pendingFullReturn;
    const pricing = fullReturn ? fullReturnPricing : partialReturnPricing;

    setSubmitting(true);
    setMessage(null);

    const body = fullReturn
      ? {
          saleId: selectedId,
          fullReturn: true,
          notes: notes.trim() || null,
        }
      : {
          saleId: selectedId,
          items: returnLines,
          notes: notes.trim() || null,
        };

    try {
      await runPendingOperation(async () => {
        const { ok, data } = await apiJson<{
          message?: string;
          saleReturn?: { returnNumber: string; total?: number };
        }>("/api/sales/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        setConfirmOpen(false);

        if (ok) {
          const retNum = data.saleReturn?.returnNumber ?? "";
          const retTotal = data.saleReturn?.total ?? pricing.total;
          const successText = `تم تسجيل المرتجع ${retNum} — المُرد للعميل: ${formatCurrency(retTotal)} ج.م`;
          setMessage({ type: "ok", text: successText });
          toast.success(successText);
          closeInvoicePanel();
          void loadSales(activeQuery);
          return;
        }

        setMessage({
          type: "err",
          text: (data as { message?: string })?.message || "فشل تسجيل المرتجع",
        });
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activePricing =
    returnLines.length > 0 ? partialReturnPricing : fullReturnPricing;

  const confirmPricing = pendingFullReturn ? fullReturnPricing : partialReturnPricing;

  const confirmRows = useMemo((): ReturnConfirmRow[] => {
    if (!returnableSale) return [];
    const hasDiscount = returnableSale.discount > 0.001;
    const hasTax = returnableSale.taxRate > 0.001;
    return [
      { label: "الفاتورة", value: returnableSale.invoiceNumber },
      {
        label: "خصم",
        value: hasDiscount
          ? `نعم — ${formatCurrency(confirmPricing.discount)} ج.م`
          : "لا",
      },
      {
        label: "ضريبة",
        value: hasTax
          ? `نعم — ${confirmPricing.taxRate}% (${formatCurrency(confirmPricing.taxAmount)} ج.م)`
          : "لا",
      },
      {
        label: "المبلغ المُرد للعميل",
        value: `${formatCurrency(confirmPricing.total)} ج.م`,
        highlight: true,
        accent: "amber",
      },
    ];
  }, [returnableSale, confirmPricing]);

  return (
    <>
      <PageHeader
        title="مرتجع مبيعات"
        subtitle="اختر فاتورة بيع وأرجعها كاملة أو جزئياً — يُرد المبلغ للعميل"
        action={{ label: "استعراض المبيعات", href: "/dashboard/sales" }}
        showHomeButton
      />

      <div className="glass-card p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-white">تصفية الفواتير</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">رقم الفاتورة</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="SAL-MAD-00000001"
              className="glass-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">العميل</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="glass-input text-sm"
            >
              <option value="">— الكل —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="glass-input text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyDateFilters}
            disabled={!hasPendingDateFilters}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            تطبيق فترة التاريخ
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5"
            >
              مسح الفلتر
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-xl text-sm border ${
            message.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="glass-card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                  العميل
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  التاريخ
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  الإجمالي
                </ThEmoji>
                <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                  المرتجع
                </ThEmoji>
                <th className="text-right p-4 font-medium">اختيار</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    جاري التحميل...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    {hasActiveFilters
                      ? "لا توجد فواتير مطابقة للفلتر"
                      : "لا توجد فواتير قابلة للإرجاع"}
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const rs = returnStatusMap[s.returnStatus] || returnStatusMap.none;
                  const isSelected = selectedId === s.id;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border/40 transition-colors ${
                        isSelected
                          ? "bg-primary/15 ring-1 ring-inset ring-primary/50"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="p-4 text-sm font-semibold text-primary-light">
                        <CellEmoji emoji={em.invoice}>{s.invoiceNumber}</CellEmoji>
                      </td>
                      <td className="p-4 text-sm text-white font-medium">
                        <CellEmoji emoji={em.customer}>
                          {s.customer?.nameAr || "عميل نقدي"}
                        </CellEmoji>
                      </td>
                      <td className="p-4 text-xs text-muted-dark">
                        <CellEmoji emoji={em.date}>
                          {new Date(s.saleDate).toLocaleDateString("ar-EG")}
                        </CellEmoji>
                      </td>
                      <td className="p-4 text-sm font-semibold text-white">
                        <CellEmoji emoji={em.total}>{formatCurrency(s.total)} ج.م</CellEmoji>
                      </td>
                      <td className="p-4">
                        {s.returnStatus !== "none" && (
                          <span className={rs.class}>{rs.label}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : s.id)}
                          className={`inline-flex px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                            isSelected
                              ? "bg-primary text-white border-primary shadow-glow-sm"
                              : "bg-white/5 border-border text-primary-light hover:bg-primary/15"
                          }`}
                        >
                          {isSelected ? "✓ محددة" : "اختيار"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <div
          ref={detailPanelRef}
          className="glass-card p-5 space-y-4 border border-red-500/30 bg-red-500/[0.09] shadow-[inset_0_1px_0_rgba(248,113,113,0.08)]"
        >
          {loadingReturnable ? (
            <p className="text-center text-muted py-8">جاري تحميل أصناف الفاتورة...</p>
          ) : returnableSale ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{returnableSale.invoiceNumber}</h3>
                  <p className="text-sm text-muted mt-1">
                    {returnableSale.customer.nameAr} —{" "}
                    {new Date(returnableSale.saleDate).toLocaleDateString("ar-EG")}
                  </p>
                </div>
              </div>

              <RefundSummary
                pricing={activePricing}
                saleDiscount={returnableSale.discount}
                saleTaxRate={returnableSale.taxRate}
              />

              {!canReturnAny && (
                <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  لا توجد أصناف قابلة للإرجاع في هذه الفاتورة.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-dark border-b border-border">
                      <th className="text-right p-3">الصنف</th>
                      <th className="text-right p-3">الكمية</th>
                      <th className="text-right p-3">مُرجَع</th>
                      <th className="text-right p-3">متاح</th>
                      <th className="text-right p-3">سعر الوحدة</th>
                      <th className="text-right p-3">كمية الإرجاع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnableItems.map((item) => (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="p-3">
                          <div className="font-medium text-white">{item.description}</div>
                          {item.isPhone && item.imei && (
                            <div className="text-xs text-muted mt-1">
                              IMEI: {formatStoredDeviceImeis(item.imei)}
                            </div>
                          )}
                          {!item.isPhone && item.barcode && (
                            <div className="text-xs text-muted mt-1">باركود: {item.barcode}</div>
                          )}
                          {item.blockReason && !item.canReturn && (
                            <div className="text-xs text-red-400 mt-1">{item.blockReason}</div>
                          )}
                        </td>
                        <td className="p-3 text-muted">{item.quantity}</td>
                        <td className="p-3 text-muted">{item.returnedQuantity}</td>
                        <td className="p-3">{item.returnableQuantity}</td>
                        <td className="p-3">{formatCurrency(item.unitPrice)} ج.م</td>
                        <td className="p-3">
                          {item.canReturn ? (
                            item.isPhone ? (
                              <input
                                type="checkbox"
                                checked={(returnQty[item.id] ?? 0) > 0}
                                onChange={(e) =>
                                  setItemQty(item.id, e.target.checked ? 1 : 0, 1)
                                }
                                className="w-4 h-4"
                              />
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={item.returnableQuantity}
                                value={returnQty[item.id] ?? 0}
                                onChange={(e) =>
                                  setItemQty(
                                    item.id,
                                    parseInt(e.target.value, 10) || 0,
                                    item.returnableQuantity
                                  )
                                }
                                className="glass-input w-20 text-sm py-1"
                              />
                            )
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="glass-input text-sm w-full"
                  placeholder="سبب الإرجاع..."
                />
              </div>

              {!canPartialReturn && canReturnAny && (
                <p className="text-xs text-muted bg-white/5 border border-border rounded-xl px-3 py-2">
                  صنف واحد فقط بكمية 1 — الإرجاع المتاح هو المرتجع الكامل.
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {canPartialReturn && (
                  <>
                    <button
                      type="button"
                      disabled={submitting || !canReturnAny}
                      onClick={() => openReturnConfirm(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40"
                    >
                      {submitting ? "جاري الحفظ..." : "تسجيل مرتجع جزئي"}
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !canReturnAny}
                      onClick={selectFullReturn}
                      className="px-4 py-2.5 rounded-xl text-sm border border-border text-muted hover:bg-white/5 disabled:opacity-40"
                    >
                      تحديد الكل
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={submitting || !canReturnAny}
                  onClick={() => openReturnConfirm(true)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
                >
                  {canPartialReturn ? "مرتجع كامل" : "تسجيل المرتجع"}
                </button>
                <button
                  type="button"
                  onClick={closeInvoicePanel}
                  className="px-4 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5 mr-auto"
                >
                  إغلاق
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
      <ReturnConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void executeReturn()}
        title={pendingFullReturn ? "تأكيد مرتجع كامل" : "تأكيد مرتجع جزئي"}
        rows={confirmRows}
        loading={submitting}
      />
    </>
  );
}
