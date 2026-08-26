"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import TransactionTypeBadge from "@/components/ui/TransactionTypeBadge";
import Modal from "@/components/ui/Modal";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatAmountExact } from "@/lib/utils";
import { runPendingOperation } from "@/store/pending-operation-store";

interface TreasuryTransaction {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  date: string;
  createdAt: string;
  documentNumber: string;
  description: string;
  detailUrl: string;
  paymentMethod?: string | null;
}

interface ShiftSummary {
  currentBalance: number;
  totalIn: number;
  totalOut: number;
  netInPeriod: number;
  grossNet?: number;
  vaultDeposited?: number;
  remainingToDeposit?: number;
}

interface TreasuryView {
  openShift: {
    transactions: TreasuryTransaction[];
    summary: ShiftSummary;
  };
  deposited: {
    transactions: TreasuryTransaction[];
    summary: Pick<ShiftSummary, "totalIn" | "totalOut" | "netInPeriod">;
  };
  currentBalance: number;
}

function buildQuery(dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const q = params.toString();
  return q ? `?${q}` : "";
}

function TreasuryTable({
  transactions,
  loading,
  emptyMessage,
}: {
  transactions: TreasuryTransaction[];
  loading: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                رقم المستند
              </ThEmoji>
              <th className="text-right p-4 font-medium">النوع</th>
              <th className="text-right p-4 font-medium">البيان</th>
              <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                التاريخ / الوقت
              </ThEmoji>
              <ThEmoji emoji={em.payment} className="text-right p-4 font-medium">
                الدفع
              </ThEmoji>
              <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                المبلغ
              </ThEmoji>
              <ThEmoji emoji={em.view} className="text-right p-4 font-medium">
                تفاصيل
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted text-sm">
                  جاري التحميل...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="p-4 text-sm font-semibold text-primary-light">
                      {tx.documentNumber}
                    </td>
                    <td className="p-4">
                      <TransactionTypeBadge type={tx.type} label={tx.typeLabel} />
                    </td>
                    <td className="p-4 text-sm text-white max-w-[260px]">{tx.description}</td>
                    <td className="p-4">
                      <DocumentDateTimeStack value={tx.date} />
                    </td>
                    <td className="p-4 text-xs text-muted">{tx.paymentMethod || "—"}</td>
                    <td className="p-4">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          tx.direction === "in" ? "text-accent-green" : "text-red-400"
                        }`}
                      >
                        {tx.direction === "in" ? "+" : "−"}
                        {formatAmountExact(tx.amount)} ج.م
                      </span>
                    </td>
                    <td className="p-4">
                      <Link
                        href={tx.detailUrl}
                        className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 border border-primary/30 text-primary-light hover:bg-primary/25"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && transactions.length > 0 && (
        <p className="p-3 text-xs text-muted border-t border-border/40">
          {transactions.length} حركة — مرتّبة من الأحدث
        </p>
      )}
    </div>
  );
}

export default function TreasuryPage() {
  const [view, setView] = useState<TreasuryView | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [depositing, setDepositing] = useState(false);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const { ok, data } = await apiJson<TreasuryView>(`/api/treasury${buildQuery(from, to)}`);
    if (ok) setView(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(appliedDates.dateFrom, appliedDates.dateTo);
  }, [appliedDates.dateFrom, appliedDates.dateTo, load]);

  const applyDateFilters = () => {
    setAppliedDates({ dateFrom, dateTo });
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
  };

  const handleCloseShift = async () => {
    const pendingLedgerCount = pendingTransactions.filter(
      (tx) => tx.type !== "open_shift_deposit"
    ).length;
    if (pendingLedgerCount === 0) {
      toast.warning("لا توجد حركات لم تُورد بعد");
      return;
    }

    const confirmed = window.confirm(
      `تقفيل الوردية الحالية؟\n\nسيتم توريد ${pendingLedgerCount} حركة إلى سجل الحركات الموردة.` +
        (remainingToDeposit > 0
          ? `\n\nسيتم أيضاً توريد ${formatAmountExact(remainingToDeposit)} ج.م المتبقية إلى خزنة الفرع.`
          : vaultDeposited > 0
            ? "\n\nتم توريد النقدية للخزنة مسبقاً — لن يُضاف مبلغ إضافي عند التقفيل."
            : "")
    );
    if (!confirmed) return;

    setClosing(true);
    const { ok, data } = await apiJson<{ message?: string; shiftNumber?: string }>(
      "/api/treasury/close-shift",
      { method: "POST" }
    );
    setClosing(false);

    if (ok) {
      toast.success(data.message || "تم تقفيل الوردية");
      void load(appliedDates.dateFrom, appliedDates.dateTo);
      return;
    }

    toast.error(data.message || "تعذر تقفيل الوردية");
  };

  const handleDepositToVault = async () => {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }

    setDepositing(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>("/api/treasury/deposit-to-vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            notes: depositNotes.trim() || undefined,
          }),
        })
      );

      if (ok) {
        toast.success(data.message || "تم توريد النقدية للخزنة");
        setDepositModalOpen(false);
        setDepositAmount("");
        setDepositNotes("");
        void load(appliedDates.dateFrom, appliedDates.dateTo);
        return;
      }

      toast.error(data.message || "تعذر توريد النقدية");
    } finally {
      setDepositing(false);
    }
  };

  const openSummary = view?.openShift.summary ?? {
    currentBalance: 0,
    totalIn: 0,
    totalOut: 0,
    netInPeriod: 0,
    grossNet: 0,
    vaultDeposited: 0,
    remainingToDeposit: 0,
  };
  const depositedSummary = view?.deposited.summary ?? { totalIn: 0, totalOut: 0, netInPeriod: 0 };
  const pendingTransactions = view?.openShift.transactions ?? [];
  const depositedTransactions = view?.deposited.transactions ?? [];
  const remainingToDeposit = openSummary.remainingToDeposit ?? openSummary.netInPeriod;
  const vaultDeposited = openSummary.vaultDeposited ?? 0;
  const grossNet = openSummary.grossNet ?? openSummary.netInPeriod;
  const canDepositToVault = remainingToDeposit > 0;
  const pendingLedgerCount = pendingTransactions.filter(
    (tx) => tx.type !== "open_shift_deposit"
  ).length;
  const hasActiveFilters = Boolean(appliedDates.dateFrom || appliedDates.dateTo);
  const hasPendingDateFilters =
    dateFrom !== appliedDates.dateFrom || dateTo !== appliedDates.dateTo;

  return (
    <>
      <PageHeader
        title="تقفيل الوردية"
        subtitle="الوردية المفتوحة — الحركات المعلقة — والحركات الموردة"
        extraAction={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDepositModalOpen(true)}
              disabled={loading || !canDepositToVault}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent-green/20 border border-accent-green/40 text-accent-green text-sm font-bold hover:bg-accent-green/30 disabled:opacity-40 transition-all"
            >
              توريد نقدية للخزنة
            </button>
            <button
              type="button"
              onClick={() => void handleCloseShift()}
              disabled={closing || loading || pendingLedgerCount === 0}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent-orange/20 border border-accent-orange/40 text-accent-orange text-sm font-bold hover:bg-accent-orange/30 disabled:opacity-40 transition-all"
            >
              {closing ? "جاري التقفيل..." : "تقفيل الوردية"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          variant={remainingToDeposit >= 0 ? "profit" : "loss"}
          delay={0}
          title="الباقي للتوريد"
          value={remainingToDeposit}
          suffix="ج.م"
          subtitle={
            vaultDeposited > 0
              ? `صافي الحركات: ${formatAmountExact(grossNet)} — مُورد للخزنة: ${formatAmountExact(vaultDeposited)}`
              : `صافي الحركات: ${formatAmountExact(grossNet)} — رصيد الخزنة الكلي: ${formatAmountExact(view?.currentBalance ?? 0)}`
          }
          emoji={remainingToDeposit >= 0 ? "💵" : "⚠️"}
        />
        <KpiCard
          variant="sales"
          delay={80}
          title="وارد الوردية"
          value={openSummary.totalIn}
          suffix="ج.م"
          subtitle="لم يُورد بعد"
          emoji="💰"
        />
        <KpiCard
          variant="expenses"
          delay={160}
          title="صادر الوردية"
          value={openSummary.totalOut}
          suffix="ج.م"
          subtitle="لم يُورد بعد"
          emoji="💸"
        />
        <KpiCard
          variant="invoices"
          delay={240}
          title="حركات معلقة"
          value={pendingLedgerCount}
          subtitle="في الوردية المفتوحة (بدون توريدات الخزنة)"
          emoji="📋"
        />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-bold text-white mb-1">حركات لم تُورد بعد</h2>
        <p className="text-xs text-muted">الوردية المفتوحة — تُنقل للسجل المورد عند تقفيل الوردية (يشمل توريدات الخزنة الجزئية)</p>
      </div>

      <div className="mb-8">
        <TreasuryTable
          transactions={pendingTransactions}
          loading={loading}
          emptyMessage="لا توجد حركات معلقة — كل الحركات مُوردة"
        />
      </div>

      <div className="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white mb-1">الحركات الموردة</h2>
          <p className="text-xs text-muted">
            وارد: {formatAmountExact(depositedSummary.totalIn)} — صادر:{" "}
            {formatAmountExact(depositedSummary.totalOut)}
            {hasActiveFilters ? " (الفترة المحددة)" : ""}
          </p>
        </div>
      </div>

      <div className="glass-card p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-white">تصفية بالتاريخ</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="glass-input"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyDateFilters}
            disabled={!hasPendingDateFilters}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40"
          >
            تطبيق
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

      <TreasuryTable
        transactions={depositedTransactions}
        loading={loading}
        emptyMessage={hasActiveFilters ? "لا توجد حركات موردة في هذه الفترة" : "لا توجد حركات موردة بعد"}
      />

      <Modal
        open={depositModalOpen}
        onClose={() => !depositing && setDepositModalOpen(false)}
        title="توريد نقدية من الوردية المفتوحة"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-background-input/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">صافي حركات الوردية</span>
              <strong className="text-white tabular-nums">{formatAmountExact(grossNet)} ج.م</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">مُورد للخزنة مسبقاً</span>
              <strong className="text-violet-300 tabular-nums">{formatAmountExact(vaultDeposited)} ج.م</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-2">
              <span className="text-white font-semibold">المتاح للتوريد الآن</span>
              <strong className="text-accent-green tabular-nums">{formatAmountExact(remainingToDeposit)} ج.م</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">المبلغ المراد توريده</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="glass-input"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              placeholder="سبب التوريد أو ملاحظة..."
              className="glass-input"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDepositAmount(String(remainingToDeposit))}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-border text-muted hover:bg-white/5"
            >
              توريد كامل المتبقي
            </button>
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setDepositModalOpen(false)}
              disabled={depositing}
              className="px-4 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5 disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => void handleDepositToVault()}
              disabled={depositing || !canDepositToVault}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-accent-green/25 border border-accent-green/40 text-accent-green hover:bg-accent-green/35 disabled:opacity-40"
            >
              {depositing ? "جاري التوريد..." : "تأكيد التوريد"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
