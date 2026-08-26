"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ActionEmoji, CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { ClearableInput } from "@/components/ui/FilterControls";
import { apiJson } from "@/lib/api-client";
import { formatDocumentDate, formatDocumentTime } from "@/lib/document-datetime";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { formatAmountExact, formatCurrency, cn } from "@/lib/utils";
import {
  SUPPLIER_KIND_INDIVIDUAL_CUSTOMER,
  SUPPLIER_KIND_WHOLESALE,
} from "@/lib/supplier-kind";

type DebtTab = typeof SUPPLIER_KIND_WHOLESALE | typeof SUPPLIER_KIND_INDIVIDUAL_CUSTOMER;

interface DebtRow {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  dueDate: string | null;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  total: number;
  paidAmount: number;
  outstanding: number;
  paymentType: string;
  paymentTypeLabel: string;
}

interface SupplierOption {
  id: string;
  nameAr: string;
  phone: string | null;
}

interface PaymentScheduleRow {
  seq: number;
  phase: "invoice" | "settlement";
  label: string;
  amount: number;
  paidAt: string;
  cashSourceLabel: string | null;
  notes: string | null;
  recordedByName: string | null;
  runningPaidTotal: number;
}

interface PaymentDetailsResponse {
  purchase: {
    invoiceNumber: string;
    supplierName: string;
    paymentTypeLabel: string;
    total: number;
    paidAmount: number;
    outstanding: number;
    creditOnInvoice: number;
    initialPaymentAtInvoice: number;
    laterPaymentsTotal: number;
  };
  schedule: PaymentScheduleRow[];
}

function DebtTable({
  rows,
  loading,
  emptyMessage,
  onPay,
  onDetails,
  showPayAction,
  stickyHeader = false,
  scrollMaxHeight,
  headRowClassName,
  partyColumnLabel = "المورد",
}: {
  rows: DebtRow[];
  loading: boolean;
  emptyMessage: string;
  onPay?: (row: DebtRow) => void;
  onDetails: (row: DebtRow) => void;
  showPayAction: boolean;
  stickyHeader?: boolean;
  scrollMaxHeight?: string;
  headRowClassName?: string;
  partyColumnLabel?: string;
}) {
  const viewportClass = scrollMaxHeight
    ? cn("overflow-auto", scrollMaxHeight)
    : "overflow-x-auto";

  return (
    <div className={viewportClass}>
      <table className="w-full min-w-[980px] border-collapse">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          <tr
            className={cn(
              "text-xs text-muted-dark border-b border-border",
              stickyHeader
                ? "bg-background-input/95 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]"
                : "bg-background-input/30",
              headRowClassName
            )}
          >
            <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
              الفاتورة
            </ThEmoji>
            <ThEmoji emoji="📅" className="text-right p-4 font-medium">
              التاريخ
            </ThEmoji>
            <ThEmoji emoji={em.supplier} className="text-right p-4 font-medium">
              {partyColumnLabel}
            </ThEmoji>
            <ThEmoji emoji="💳" className="text-right p-4 font-medium">
              نوع الدفع
            </ThEmoji>
            <ThEmoji emoji="💰" className="text-right p-4 font-medium">
              الإجمالي
            </ThEmoji>
            <ThEmoji emoji="✅" className="text-right p-4 font-medium">
              المسدّد
            </ThEmoji>
            <ThEmoji emoji="⚠️" className="text-right p-4 font-medium">
              المتبقي
            </ThEmoji>
            <ThEmoji emoji={em.actions} className="text-center p-4 font-medium">
              إجراء
            </ThEmoji>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-muted">
                جاري التحميل...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                <td className="p-4">
                  <Link
                    href={`/dashboard/purchases/${row.id}`}
                    className="text-primary-light hover:underline font-medium"
                  >
                    {row.invoiceNumber}
                  </Link>
                </td>
                <td className="p-4">
                  <DocumentDateTimeStack value={row.purchaseDate} />
                </td>
                <td className="p-4 text-sm">{row.supplierName}</td>
                <td className="p-4 text-sm">{row.paymentTypeLabel}</td>
                <td className="p-4 tabular-nums">{formatAmountExact(row.total)}</td>
                <td className="p-4 tabular-nums text-accent-green">
                  {formatAmountExact(row.paidAmount)}
                </td>
                <td className="p-4 tabular-nums text-accent-orange font-bold">
                  {formatAmountExact(row.outstanding)}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    {showPayAction && row.outstanding > 0.0001 && onPay && (
                      <ActionEmoji
                        emoji="💵"
                        title="تسجيل سداد"
                        onClick={() => onPay(row)}
                      />
                    )}
                    <ActionEmoji
                      emoji={em.view}
                      title="تفاصيل السداد"
                      onClick={() => onDetails(row)}
                      className="text-muted hover:text-white hover:border-primary/30"
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PurchaseDebtsPage() {
  const [outstandingRows, setOutstandingRows] = useState<DebtRow[]>([]);
  const [settledRows, setSettledRows] = useState<DebtRow[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [totals, setTotals] = useState({ totalAmount: 0, paidAmount: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [debtTab, setDebtTab] = useState<DebtTab>(SUPPLIER_KIND_WHOLESALE);
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsResponse | null>(null);
  const [selectedRow, setSelectedRow] = useState<DebtRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payCashSource, setPayCashSource] = useState<"shift" | "vault">("shift");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [settledOpen, setSettledOpen] = useState(false);

  const debtTableScrollClass = "max-h-[min(28rem,calc(100vh-20rem))] min-h-[10rem]";

  const loadDebts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("supplierKind", debtTab);
    if (supplierId) params.set("supplierId", supplierId);
    if (search.trim()) params.set("search", search.trim());
    const q = params.toString();
    const { ok, data } = await apiJson<{
      outstandingRows: DebtRow[];
      settledRows: DebtRow[];
      totals: typeof totals;
      supplierOptions: SupplierOption[];
    }>(`/api/purchases/debts${q ? `?${q}` : ""}`);
    if (ok) {
      setOutstandingRows(data.outstandingRows || []);
      setSettledRows(data.settledRows || []);
      setTotals(data.totals || { totalAmount: 0, paidAmount: 0, outstanding: 0 });
      setSupplierOptions(data.supplierOptions || []);
    }
    setLoading(false);
  }, [debtTab, supplierId, search]);

  useEffect(() => {
    setSupplierId("");
  }, [debtTab]);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  const openPayModal = (row: DebtRow) => {
    setSelectedRow(row);
    setPayAmount(String(row.outstanding));
    setPayCashSource("shift");
    setPayNotes("");
    setPayModalOpen(true);
  };

  const openDetailsModal = async (row: DebtRow) => {
    setSelectedRow(row);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setPaymentDetails(null);
    const { ok, data } = await apiJson<PaymentDetailsResponse>(
      `/api/purchases/debts/${row.id}`
    );
    setDetailsLoading(false);
    if (ok) {
      setPaymentDetails(data);
    } else {
      toast.error((data as { message?: string }).message || "تعذّر تحميل التفاصيل");
    }
  };

  const submitPayment = async () => {
    if (!selectedRow) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("أدخل مبلغ سداد صحيح");
      return;
    }
    if (amount > selectedRow.outstanding + 0.0001) {
      toast.error("المبلغ يتجاوز المتبقي على الفاتورة");
      return;
    }

    setPayLoading(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>("/api/purchases/debts/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchaseId: selectedRow.id,
            amount,
            cashSource: payCashSource,
            notes: payNotes.trim() || undefined,
          }),
        })
      );

      if (ok) {
        toast.success(data.message || "تم تسجيل السداد");
        setPayModalOpen(false);
        setSelectedRow(null);
        void loadDebts();
        return;
      }

      toast.error(data.message || "تعذّر تسجيل السداد");
    } finally {
      setPayLoading(false);
    }
  };

  const partyColumnLabel = debtTab === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER ? "العميل" : "المورد";
  const searchPlaceholder =
    debtTab === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER
      ? "رقم الفاتورة أو العميل..."
      : "رقم الفاتورة أو المورد...";

  return (
    <>
      <PageHeader
        title="تقرير الأجل والمديونات"
        subtitle="مديونيات فواتير المشتريات وسداد الأجل"
        showHomeButton
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setDebtTab(SUPPLIER_KIND_WHOLESALE)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
            debtTab === SUPPLIER_KIND_WHOLESALE
              ? "border-primary bg-primary/15 text-white"
              : "border-border text-muted hover:text-white hover:border-primary/30"
          )}
        >
          موردين (جملة)
        </button>
        <button
          type="button"
          onClick={() => setDebtTab(SUPPLIER_KIND_INDIVIDUAL_CUSTOMER)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
            debtTab === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER
              ? "border-primary bg-primary/15 text-white"
              : "border-border text-muted hover:text-white hover:border-primary/30"
          )}
        >
          عملاء أفراد
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard
          variant="purchases"
          delay={0}
          title="إجمالي فواتير الأجل المفتوحة"
          value={totals.totalAmount}
          suffix="ج.م"
          subtitle="قيمة الفواتير المفتوحة"
          emoji={em.invoice}
        />
        <KpiCard
          variant="sales"
          delay={80}
          title="المسدّد (مفتوحة)"
          value={totals.paidAmount}
          suffix="ج.م"
          subtitle="ما تم سداده حتى الآن"
          emoji="✅"
        />
        <KpiCard
          variant="expenses"
          delay={160}
          title="المتبقي (مديونية)"
          value={totals.outstanding}
          suffix="ج.م"
          subtitle="المبلغ المستحق على الفرع"
          emoji={em.issue}
        />
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">{partyColumnLabel}</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="glass-input"
            >
              <option value="">— الكل —</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">بحث</label>
            <ClearableInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder={searchPlaceholder}
              inputMode="search"
            />
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/20 to-background-input/10 overflow-hidden shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)]">
        <div className="px-4 pt-4 pb-3 border-b border-amber-500/15 bg-amber-500/[0.06]">
          <h2 className="text-sm font-bold text-amber-100">مديونيات قائمة</h2>
          <p className="text-xs text-amber-200/70 mt-1">
            {debtTab === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER
              ? "فواتير شراء من عملاء — مبلغ متبقٍ"
              : "فواتير لها مبلغ متبقٍ على المورد"}
          </p>
        </div>
        <DebtTable
          rows={outstandingRows}
          loading={loading}
          emptyMessage="لا توجد مديونيات مفتوحة"
          onPay={openPayModal}
          onDetails={(row) => void openDetailsModal(row)}
          showPayAction
          stickyHeader
          scrollMaxHeight={debtTableScrollClass}
          headRowClassName="bg-amber-950/90"
          partyColumnLabel={partyColumnLabel}
        />
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 overflow-hidden shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={() => setSettledOpen((open) => !open)}
          aria-expanded={settledOpen}
          className="w-full p-4 border-b border-emerald-500/20 bg-emerald-500/[0.08] flex items-center justify-between gap-3 text-right hover:bg-emerald-500/[0.12] transition-colors"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-emerald-100">فواتير مسدّدة بالكامل</h2>
            <p className="text-xs text-emerald-200/70 mt-1">
              {settledOpen
                ? "اضغط السهم لإخفاء الجدول"
                : `اضغط السهم لعرض الجدول · ${settledRows.length} فاتورة`}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 transition-transform duration-200",
              settledOpen && "rotate-180"
            )}
            aria-hidden
          >
            ▼
          </span>
        </button>
        {settledOpen ? (
          <DebtTable
            rows={settledRows}
            loading={loading}
            emptyMessage="لا توجد فواتير مسدّدة بعد"
            onDetails={(row) => void openDetailsModal(row)}
            showPayAction={false}
            stickyHeader
            scrollMaxHeight={debtTableScrollClass}
            headRowClassName="bg-emerald-950/90"
            partyColumnLabel={partyColumnLabel}
          />
        ) : null}
      </div>

      <Modal
        open={payModalOpen}
        onClose={() => !payLoading && setPayModalOpen(false)}
        title="تسجيل سداد"
      >
        {selectedRow && (
          <div className="space-y-4">
            <div className="text-sm text-muted">
              فاتورة <span className="text-white font-bold">{selectedRow.invoiceNumber}</span> —{" "}
              {selectedRow.supplierName}
            </div>
            <p className="text-sm">
              المتبقي:{" "}
              <span className="font-bold text-accent-orange tabular-nums">
                {formatCurrency(selectedRow.outstanding)} ج.م
              </span>
            </p>

            <div>
              <label className="block text-xs text-muted mb-1.5">مبلغ السداد</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={selectedRow.outstanding}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="glass-input"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-2">مصدر الدفع</label>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    { value: "shift", label: "من الوردية (الخزنة الحالية)" },
                    { value: "vault", label: "من خزنة الفرع" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${
                      payCashSource === opt.value
                        ? "border-accent-green bg-accent-green/10"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={payCashSource === opt.value}
                      onChange={() => setPayCashSource(opt.value)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
              <textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="glass-input min-h-[72px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={payLoading}
                onClick={() => void submitPayment()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {payLoading ? "جاري الحفظ..." : "تسجيل السداد"}
              </button>
              <button
                type="button"
                disabled={payLoading}
                onClick={() => setPayModalOpen(false)}
                className="btn-outline"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="تفاصيل السداد"
        size="lg"
      >
        {detailsLoading ? (
          <p className="text-sm text-muted py-8 text-center animate-pulse">جاري التحميل...</p>
        ) : paymentDetails ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-background-input/20 p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">فاتورة مشتريات</p>
                  <p className="text-lg font-bold text-white">{paymentDetails.purchase.invoiceNumber}</p>
                  <p className="text-sm text-muted mt-0.5">{paymentDetails.purchase.supplierName}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/15 text-primary-light border border-primary/25">
                  {paymentDetails.purchase.paymentTypeLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 pt-1 border-t border-border/40">
                <div>
                  <p className="text-[11px] text-primary-light/90 mb-1">إجمالي الفاتورة</p>
                  <p className="text-base font-bold tabular-nums text-white">
                    {formatCurrency(paymentDetails.purchase.total)} ج.م
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-accent-green/90 mb-1">دفع عند الفاتورة</p>
                  <p className="text-base font-bold tabular-nums text-accent-green">
                    {formatCurrency(paymentDetails.purchase.initialPaymentAtInvoice)} ج.م
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-amber-200/90 mb-1">الأجل (الباقي) عند عمل الفاتورة</p>
                  <p className="text-base font-bold tabular-nums text-amber-300">
                    {formatCurrency(paymentDetails.purchase.creditOnInvoice)} ج.م
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-4">
                <p className="text-[11px] text-cyan-200/90 mb-1.5">إجمالي المسدّد</p>
                <p className="text-lg font-bold tabular-nums text-cyan-300">
                  {formatCurrency(paymentDetails.purchase.paidAmount)} ج.م
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  paymentDetails.purchase.outstanding > 0.0001
                    ? "border-red-500/35 bg-red-500/10"
                    : "border-emerald-500/35 bg-emerald-500/10"
                }`}
              >
                <p
                  className={`text-[11px] mb-1.5 ${
                    paymentDetails.purchase.outstanding > 0.0001
                      ? "text-red-200/90"
                      : "text-emerald-200/90"
                  }`}
                >
                  المتبقي الآن
                </p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    paymentDetails.purchase.outstanding > 0.0001
                      ? "text-red-300"
                      : "text-emerald-300"
                  }`}
                >
                  {formatCurrency(paymentDetails.purchase.outstanding)} ج.م
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">جدول الدفعات</h3>
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                        <th className="text-right p-3 font-medium w-12">#</th>
                        <th className="text-right p-3 font-medium">الحركة</th>
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">المبلغ</th>
                        <th className="text-right p-3 font-medium">المصدر</th>
                        <th className="text-right p-3 font-medium">إجمالي المسدّد</th>
                        <th className="text-right p-3 font-medium">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentDetails.schedule.map((row) => (
                        <tr
                          key={`${row.phase}-${row.seq}`}
                          className="border-b border-border/40 hover:bg-white/[0.02]"
                        >
                          <td className="p-3 text-sm text-muted tabular-nums">{row.seq}</td>
                          <td className="p-3 text-sm font-medium">
                            <span
                              className={
                                row.phase === "invoice"
                                  ? "text-primary-light"
                                  : "text-accent-green"
                              }
                            >
                              {row.label}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-muted leading-snug">
                            <div className="whitespace-nowrap">{formatDocumentDate(row.paidAt)}</div>
                            <div className="whitespace-nowrap text-[11px] text-muted-dark tabular-nums mt-0.5">
                              {formatDocumentTime(row.paidAt)}
                            </div>
                          </td>
                          <td className="p-3 tabular-nums font-semibold text-accent-green">
                            {formatAmountExact(row.amount)} ج.م
                          </td>
                          <td className="p-3 text-sm text-muted">
                            {row.cashSourceLabel || "—"}
                          </td>
                          <td className="p-3 tabular-nums text-sm font-medium">
                            {formatAmountExact(row.runningPaidTotal)} ج.م
                          </td>
                          <td className="p-3 text-xs text-muted max-w-[180px]">
                            {row.recordedByName ? (
                              <span className="block mb-0.5">بواسطة: {row.recordedByName}</span>
                            ) : null}
                            {row.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-background-input/20 text-sm font-bold">
                        <td colSpan={3} className="p-3 text-right">
                          إجمالي المسدّد
                        </td>
                        <td className="p-3 tabular-nums text-accent-green">
                          {formatAmountExact(paymentDetails.purchase.paidAmount)} ج.م
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted py-8 text-center">تعذّر تحميل التفاصيل</p>
        )}
      </Modal>
    </>
  );
}
