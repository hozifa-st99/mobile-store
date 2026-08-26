"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { formatCurrency, formatPriceAfterExpense } from "@/lib/utils";
import {
  computeExpenseHandlingSplit,
  type PurchaseReturnExpenseHandling,
} from "@/lib/purchase-return-expense";
import { apiJson } from "@/lib/api-client";
import ReturnConfirmModal, {
  type ReturnConfirmRow,
} from "@/components/returns/ReturnConfirmModal";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { scrollElementToPageTopAfterPaint } from "@/lib/scroll-to-element";

interface Supplier {
  id: string;
  nameAr: string;
}

interface Purchase {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  status: string;
  total: number;
  returnStatus: string;
  supplier: { id: string; nameAr: string };
}

interface ReturnableItem {
  id: string;
  description: string;
  quantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  unitPriceBefore: number;
  unitPriceAfter: number;
  hasExpenseLine: boolean;
  refundUnitPrice: number;
  expensePerUnit: number;
  isPhone: boolean;
  barcode: string | null;
  imeis: { imei: string; status: string }[];
  canReturn: boolean;
  blockReason: string | null;
}

interface ReturnablePurchase {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  total: number;
  returnStatus: string;
  hasExpenses: boolean;
  expenseLine: string | null;
  supplier: { nameAr: string };
}

interface QueryFilters {
  invoiceNumber: string;
  supplierId: string;
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
  if (filters.supplierId) params.set("supplierId", filters.supplierId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return `?${params.toString()}`;
}

export default function PurchaseReturnsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [returnablePurchase, setReturnablePurchase] = useState<ReturnablePurchase | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [canReturnAny, setCanReturnAny] = useState(false);
  const [hasExpenses, setHasExpenses] = useState(false);
  const [loadingReturnable, setLoadingReturnable] = useState(false);

  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [expenseHandling, setExpenseHandling] =
    useState<PurchaseReturnExpenseHandling>("redistribute");
  const [expenseRecoveredInput, setExpenseRecoveredInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFullReturn, setPendingFullReturn] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const activeQuery: QueryFilters = {
    invoiceNumber,
    supplierId,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
  };

  const loadPurchases = useCallback(async (query: QueryFilters) => {
    setLoading(true);
    const { ok, data } = await apiJson<{ purchases: Purchase[] }>(
      `/api/purchases${buildQuery(query)}`
    );
    if (ok) setPurchases(data.purchases || []);
    setLoading(false);
  }, []);

  const loadReturnable = useCallback(async (purchaseId: string) => {
    setLoadingReturnable(true);
    const { ok, data } = await apiJson<{
      purchase: ReturnablePurchase;
      items: ReturnableItem[];
      canReturnAny: boolean;
      hasExpenses: boolean;
    }>(`/api/purchases/${purchaseId}/returnable`);
    if (ok && data) {
      setReturnablePurchase(data.purchase);
      setReturnableItems(data.items || []);
      setCanReturnAny(data.canReturnAny);
      setHasExpenses(Boolean(data.hasExpenses || data.purchase?.hasExpenses));
      setExpenseHandling("redistribute");
      setExpenseRecoveredInput("");
      const initial: Record<string, number> = {};
      for (const item of data.items || []) {
        if (item.canReturn) initial[item.id] = 0;
      }
      setReturnQty(initial);
    } else {
      setReturnablePurchase(null);
      setReturnableItems([]);
      setCanReturnAny(false);
      setHasExpenses(false);
    }
    setLoadingReturnable(false);
  }, []);

  useEffect(() => {
    apiJson<{ suppliers: Supplier[] }>("/api/suppliers").then(({ ok, data }) => {
      if (ok) setSuppliers(data.suppliers || []);
    });
  }, []);

  useEffect(() => {
    void loadPurchases(activeQuery);
  }, [invoiceNumber, supplierId, appliedDates.dateFrom, appliedDates.dateTo, loadPurchases]);

  useEffect(() => {
    if (selectedId) void loadReturnable(selectedId);
    else {
      setReturnablePurchase(null);
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

  const applyDateFilters = () => setAppliedDates({ dateFrom, dateTo });

  const resetFilters = () => {
    setInvoiceNumber("");
    setSupplierId("");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
    setSelectedId(null);
  };

  const hasActiveFilters = Boolean(
    invoiceNumber.trim() || supplierId || appliedDates.dateFrom || appliedDates.dateTo
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

  const selectedLines = useMemo(() => {
    return returnableItems
      .filter((item) => item.canReturn && (returnQty[item.id] ?? 0) > 0)
      .map((item) => {
        const qty = returnQty[item.id] ?? 0;
        return {
          purchaseItemId: item.id,
          quantity: qty,
          refundTotal: qty * item.refundUnitPrice,
          expenseShare: qty * item.expensePerUnit,
        };
      });
  }, [returnableItems, returnQty]);

  const refundTotal = selectedLines.reduce((s, l) => s + l.refundTotal, 0);
  const expenseNotRefunded = selectedLines.reduce((s, l) => s + l.expenseShare, 0);

  const hasRemainingAfterSelection = useMemo(() => {
    return returnableItems.some((item) => {
      const returning = returnQty[item.id] ?? 0;
      const left = item.returnableQuantity - returning;
      return left > 0;
    });
  }, [returnableItems, returnQty]);

  const fullReturnExpensePreview = useMemo(
    () =>
      returnableItems
        .filter((i) => i.canReturn)
        .reduce((s, i) => s + i.returnableQuantity * i.expensePerUnit, 0),
    [returnableItems]
  );

  const displayExpenseAmount =
    selectedLines.length > 0 ? expenseNotRefunded : fullReturnExpensePreview;

  const parsedRecoveredAmount = useMemo(() => {
    const n = parseFloat(expenseRecoveredInput.replace(/,/g, "."));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [expenseRecoveredInput]);

  const effectiveExpenseHandling: PurchaseReturnExpenseHandling =
    expenseHandling === "partial_recovery"
      ? "partial_recovery"
      : hasExpenses && displayExpenseAmount > 0.001 && !hasRemainingAfterSelection
        ? "daily_expense"
        : expenseHandling;

  const expensePreviewSplit = useMemo(
    () =>
      computeExpenseHandlingSplit({
        handling: effectiveExpenseHandling,
        totalOrphaned: displayExpenseAmount,
        recoveredAmount: parsedRecoveredAmount,
        hasRemainingItems: hasRemainingAfterSelection,
      }),
    [
      effectiveExpenseHandling,
      displayExpenseAmount,
      parsedRecoveredAmount,
      hasRemainingAfterSelection,
    ]
  );

  const cashReturnTotal = refundTotal + expensePreviewSplit.recovered;

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

  const fullReturnRefundTotal = useMemo(
    () =>
      returnableItems
        .filter((i) => i.canReturn)
        .reduce((s, i) => s + i.returnableQuantity * i.refundUnitPrice, 0),
    [returnableItems]
  );

  const confirmRefundTotal = pendingFullReturn ? fullReturnRefundTotal : refundTotal;

  const confirmExpensePreviewSplit = useMemo(() => {
    const totalOrphaned = pendingFullReturn ? fullReturnExpensePreview : displayExpenseAmount;
    const hasRemaining = pendingFullReturn ? false : hasRemainingAfterSelection;
    const handling: PurchaseReturnExpenseHandling =
      expenseHandling === "partial_recovery"
        ? "partial_recovery"
        : hasExpenses && totalOrphaned > 0.001 && !hasRemaining
          ? "daily_expense"
          : expenseHandling;

    return computeExpenseHandlingSplit({
      handling,
      totalOrphaned,
      recoveredAmount: parsedRecoveredAmount,
      hasRemainingItems: hasRemaining,
    });
  }, [
    pendingFullReturn,
    fullReturnExpensePreview,
    displayExpenseAmount,
    hasRemainingAfterSelection,
    expenseHandling,
    hasExpenses,
    parsedRecoveredAmount,
  ]);

  const confirmCashReturnTotal = confirmRefundTotal + confirmExpensePreviewSplit.recovered;

  const confirmRows = useMemo((): ReturnConfirmRow[] => {
    if (!returnablePurchase) return [];
    const rows: ReturnConfirmRow[] = [
      { label: "الفاتورة", value: returnablePurchase.invoiceNumber },
      {
        label: "المبلغ المُرد للمورد",
        value: `${formatCurrency(confirmRefundTotal)} ج.م`,
        highlight: true,
        accent: "primary",
      },
    ];

    if (confirmExpensePreviewSplit.recovered > 0.001) {
      rows.push({
        label: "استرداد مصروف",
        value: `${formatPriceAfterExpense(confirmExpensePreviewSplit.recovered)} ج.م`,
        accent: "emerald",
      });
    }

    if (confirmCashReturnTotal > confirmRefundTotal + 0.001) {
      rows.push({
        label: "إجمالي للخزنة",
        value: `${formatCurrency(confirmCashReturnTotal)} ج.م`,
        highlight: true,
        accent: "amber",
      });
    }

    return rows;
  }, [
    returnablePurchase,
    confirmRefundTotal,
    confirmExpensePreviewSplit.recovered,
    confirmCashReturnTotal,
  ]);

  const buildReturnPayload = (fullReturn: boolean) => {
    const fullReturnExpense = returnableItems
      .filter((i) => i.canReturn)
      .reduce((s, i) => s + i.returnableQuantity * i.expensePerUnit, 0);

    const selectedExpense = fullReturn ? fullReturnExpense : expenseNotRefunded;
    const remainingAfter = fullReturn ? false : hasRemainingAfterSelection;
    const handling: PurchaseReturnExpenseHandling =
      expenseHandling === "partial_recovery"
        ? "partial_recovery"
        : hasExpenses && selectedExpense > 0.001 && !remainingAfter
          ? "daily_expense"
          : expenseHandling;

    const recoveredForSubmit =
      handling === "partial_recovery" ? parsedRecoveredAmount : undefined;

    const needsExpenseChoice = hasExpenses && selectedExpense > 0.001;
    const baseBody = {
      purchaseId: selectedId!,
      notes,
      ...(needsExpenseChoice
        ? { expenseHandling: handling, expenseRecoveredAmount: recoveredForSubmit }
        : {}),
    };

    return fullReturn
      ? { ...baseBody, fullReturn: true }
      : {
          ...baseBody,
          items: selectedLines.map((l) => ({
            purchaseItemId: l.purchaseItemId,
            quantity: l.quantity,
          })),
        };
  };

  const openReturnConfirm = (fullReturn: boolean) => {
    if (!selectedId) return;

    if (!fullReturn && selectedLines.length === 0) {
      toast.error("اختر أصنافاً للإرجاع أو استخدم مرتجع كامل");
      return;
    }

    const fullReturnExpense = returnableItems
      .filter((i) => i.canReturn)
      .reduce((s, i) => s + i.returnableQuantity * i.expensePerUnit, 0);

    const selectedExpense = fullReturn ? fullReturnExpense : expenseNotRefunded;
    const remainingAfter = fullReturn ? false : hasRemainingAfterSelection;
    const handling: PurchaseReturnExpenseHandling =
      expenseHandling === "partial_recovery"
        ? "partial_recovery"
        : hasExpenses && selectedExpense > 0.001 && !remainingAfter
          ? "daily_expense"
          : expenseHandling;

    if (handling === "partial_recovery" && !expenseRecoveredInput.trim()) {
      toast.error("أدخل المبلغ المسترد من المصروف");
      return;
    }

    const recoveredForSubmit =
      handling === "partial_recovery" ? parsedRecoveredAmount : undefined;

    if (
      handling === "partial_recovery" &&
      recoveredForSubmit != null &&
      recoveredForSubmit > selectedExpense + 0.001
    ) {
      toast.error("المبلغ المسترد أكبر من حصة المصروف");
      return;
    }

    setPendingFullReturn(fullReturn);
    setConfirmOpen(true);
  };

  const executeReturn = async () => {
    if (!selectedId) return;

    setSubmitting(true);

    try {
      await runPendingOperation(async () => {
        const body = buildReturnPayload(pendingFullReturn);

        const { ok, data } = await apiJson<{
          message: string;
          purchaseReturn?: { returnNumber: string; total?: number };
        }>("/api/purchases/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (ok) {
          setConfirmOpen(false);
          const retNum = data.purchaseReturn?.returnNumber ?? "";
          const retTotal = data.purchaseReturn?.total;
          const successText = `تم تسجيل المرتجع ${retNum}${
            retTotal != null ? ` — ${formatCurrency(retTotal)} ج.م` : ""
          }`;
          toast.success(successText);
          setSelectedId(null);
          setReturnablePurchase(null);
          setReturnableItems([]);
          setReturnQty({});
          setNotes("");
          void loadPurchases(activeQuery);
          return;
        }

        toast.error((data as { message?: string })?.message || "فشل تسجيل المرتجع");
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="مرتجع مشتريات"
        subtitle="اختر فاتورة شراء وأرجعها كاملة أو جزئياً — يُخصم من المخزون ويُسترد المبلغ للخزنة"
        action={{ label: "استعراض المشتريات", href: "/dashboard/purchases" }}
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
              placeholder="PUR-MAD-00000001"
              className="glass-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">المورد</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="glass-input text-sm"
            >
              <option value="">— الكل —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
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

      <div className="glass-card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.supplier} className="text-right p-4 font-medium">
                  المورد
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
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    {hasActiveFilters
                      ? "لا توجد فواتير مطابقة للفلتر"
                      : "لا توجد فواتير قابلة للإرجاع"}
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const rs = returnStatusMap[p.returnStatus] || returnStatusMap.none;
                  const isSelected = selectedId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border/40 transition-colors ${
                        isSelected
                          ? "bg-primary/15 ring-1 ring-inset ring-primary/50"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="p-4 text-sm font-semibold text-primary-light">
                        <CellEmoji emoji={em.invoice}>{p.invoiceNumber}</CellEmoji>
                      </td>
                      <td className="p-4 text-sm text-muted">
                        <CellEmoji emoji={em.supplier}>{p.supplier.nameAr}</CellEmoji>
                      </td>
                      <td className="p-4 text-xs text-muted-dark">
                        <CellEmoji emoji={em.date}>
                          {new Date(p.purchaseDate).toLocaleDateString("ar-EG")}
                        </CellEmoji>
                      </td>
                      <td className="p-4 text-sm font-semibold text-white">
                        <CellEmoji emoji={em.total}>{formatCurrency(p.total)} ج.م</CellEmoji>
                      </td>
                      <td className="p-4">
                        {p.returnStatus !== "none" && (
                          <span className={rs.class}>{rs.label}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(isSelected ? null : p.id)}
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
          ) : returnablePurchase ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {returnablePurchase.invoiceNumber}
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    {returnablePurchase.supplier.nameAr} —{" "}
                    {new Date(returnablePurchase.purchaseDate).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <div className="text-left space-y-1">
                  <div>
                    <p className="text-xs text-muted">مبلغ المرتجع للمورد</p>
                    <p className="text-xl font-bold text-primary-light">
                      {formatCurrency(refundTotal)} ج.م
                    </p>
                  </div>
                  {expensePreviewSplit.recovered > 0.001 && (
                    <p className="text-xs text-emerald-300">
                      + استرداد مصروف: {formatPriceAfterExpense(expensePreviewSplit.recovered)} ج.م
                    </p>
                  )}
                  {hasExpenses && displayExpenseAmount > 0.001 && (
                    <p className="text-xs text-orange-300">
                      مصروف غير مُسترد:{" "}
                      {formatPriceAfterExpense(
                        Math.max(0, displayExpenseAmount - expensePreviewSplit.recovered)
                      )}{" "}
                      ج.م
                    </p>
                  )}
                  {(expensePreviewSplit.recovered > 0.001 || refundTotal > 0) && (
                    <div className="pt-1 border-t border-border/40">
                      <p className="text-xs text-muted">إجمالي للخزنة</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(cashReturnTotal)} ج.م
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {returnablePurchase.expenseLine && (
                <p className="text-xs text-muted bg-white/5 border border-border rounded-xl px-3 py-2">
                  {returnablePurchase.expenseLine}
                </p>
              )}

              {!canReturnAny && (
                <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  لا توجد أصناف قابلة للإرجاع في هذه الفاتورة (مباعة أو مُرجَعة بالكامل).
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-dark border-b border-border">
                      <th className="text-right p-3">الصنف</th>
                      <th className="text-right p-3">الكمية</th>
                      <th className="text-right p-3">مُرجَع</th>
                      <th className="text-right p-3">متاح</th>
                      {hasExpenses ? (
                        <>
                          <th className="text-right p-3 bg-slate-800/40">قبل المصروف</th>
                          <th className="text-right p-3 bg-orange-900/20">بعد المصروف</th>
                        </>
                      ) : (
                        <th className="text-right p-3">سعر الوحدة</th>
                      )}
                      <th className="text-right p-3">كمية الإرجاع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnableItems.map((item) => (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="p-3">
                          <div className="font-medium text-white">{item.description}</div>
                          {item.isPhone && item.imeis.length > 0 && (
                            <div className="text-xs text-muted mt-1">
                              IMEI: {item.imeis.map((i) => i.imei).join(" / ")}
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
                        {hasExpenses ? (
                          <>
                            <td className="p-3 font-semibold text-slate-300 bg-slate-800/20">
                              {formatCurrency(item.unitPriceBefore)} ج.م
                            </td>
                            <td className="p-3 font-semibold text-orange-300 bg-orange-900/10">
                              {formatPriceAfterExpense(item.unitPriceAfter)} ج.م
                            </td>
                          </>
                        ) : (
                          <td className="p-3">{formatCurrency(item.unitPrice)} ج.م</td>
                        )}
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

              {hasExpenses && displayExpenseAmount > 0.001 && canReturnAny && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-orange-200">
                    التعامل مع مصروف الأصناف المُرجَعة ({formatPriceAfterExpense(displayExpenseAmount)} ج.م)
                  </p>
                  <p className="text-xs text-muted">
                    المصروف لا يُسترد من المورد — المرتجع يُحسب على السعر قبل المصروف فقط.
                  </p>
                  <div className="space-y-2">
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        effectiveExpenseHandling === "redistribute"
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:bg-white/5"
                      } ${!hasRemainingAfterSelection ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="expenseHandling"
                        checked={effectiveExpenseHandling === "redistribute"}
                        disabled={!hasRemainingAfterSelection}
                        onChange={() => setExpenseHandling("redistribute")}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-white">
                          توزيع على الأصناف المتبقية
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          يُضاف حصة المصروف لتكلفة الأصناف المتبقية في المخزون (الفاتورة الأصلية ثابتة)
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        effectiveExpenseHandling === "partial_recovery"
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name="expenseHandling"
                        checked={effectiveExpenseHandling === "partial_recovery"}
                        onChange={() => setExpenseHandling("partial_recovery")}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-white">
                          استرداد جزء من المصروف
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          شركة الشحن أو المورد يرجّع جزءاً — أدخل المبلغ المسترد
                        </span>
                        {effectiveExpenseHandling === "partial_recovery" && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={displayExpenseAmount}
                              step="0.01"
                              value={expenseRecoveredInput}
                              onChange={(e) => setExpenseRecoveredInput(e.target.value)}
                              placeholder="0"
                              className="glass-input w-32 text-sm py-1.5"
                            />
                            <span className="text-xs text-muted">ج.م</span>
                          </div>
                        )}
                        {effectiveExpenseHandling === "partial_recovery" &&
                          expensePreviewSplit.toRedistribute > 0.001 && (
                            <p className="text-xs text-muted mt-2">
                              الباقي ({formatPriceAfterExpense(expensePreviewSplit.toRedistribute)}{" "}
                              ج.م) يُوزَّع على الأصناف المتبقية
                            </p>
                          )}
                        {effectiveExpenseHandling === "partial_recovery" &&
                          expensePreviewSplit.toDailyExpense > 0.001 && (
                            <p className="text-xs text-muted mt-2">
                              الباقي ({formatPriceAfterExpense(expensePreviewSplit.toDailyExpense)}{" "}
                              ج.م) يُنقل للمصروفات اليومية
                            </p>
                          )}
                      </span>
                    </label>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        effectiveExpenseHandling === "daily_expense"
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name="expenseHandling"
                        checked={effectiveExpenseHandling === "daily_expense"}
                        onChange={() => setExpenseHandling("daily_expense")}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-white">
                          نقل للمصروفات اليومية
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          يُسجّل بتاريخ اليوم: «من مصاريف فاتورة مشتريات {returnablePurchase.invoiceNumber}»
                        </span>
                      </span>
                    </label>
                  </div>
                  {!hasRemainingAfterSelection &&
                    effectiveExpenseHandling !== "partial_recovery" && (
                    <p className="text-xs text-amber-300">
                      مرتجع كامل — سيُنقل المصروف تلقائياً للمصروفات اليومية.
                    </p>
                  )}
                </div>
              )}

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
                  <button
                    type="button"
                    disabled={submitting || !canReturnAny}
                    onClick={() => openReturnConfirm(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40"
                  >
                    {submitting ? "جاري الحفظ..." : "تسجيل مرتجع جزئي"}
                  </button>
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
                  onClick={() => {
                    setSelectedId(null);
                    setReturnablePurchase(null);
                    setReturnableItems([]);
                    setReturnQty({});
                    setNotes("");
                  }}
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
