"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { InvoiceNumberWithCreator } from "@/components/invoices/InvoiceCreatorBadge";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { formatCurrency } from "@/lib/utils";
import { apiJson } from "@/lib/api-client";
import type { InvoiceCreatorInfo } from "@/lib/invoice-creator";

interface Supplier {
  id: string;
  nameAr: string;
}

interface Purchase {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  status: string;
  returnStatus?: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  paymentType: string;
  paymentTypeLabel: string;
  settlementLabel: string;
  settlementTone: "settled" | "partial" | "credit" | "cash";
  supplier: { id: string; nameAr: string };
  createdBy?: InvoiceCreatorInfo | null;
}

interface BranchUser extends InvoiceCreatorInfo {}

interface QueryFilters {
  invoiceNumber: string;
  supplierId: string;
  paymentType: string;
  createdByUserId: string;
  dateFrom: string;
  dateTo: string;
}

const returnStatusMap: Record<string, { label: string; class: string }> = {
  partial: { label: "مرتجع جزئي", class: "status-pending" },
  full: { label: "مرتجع كامل", class: "status-complete" },
};

const settlementToneClass: Record<Purchase["settlementTone"], string> = {
  cash: "text-accent-green",
  settled: "text-accent-green",
  partial: "text-accent-orange",
  credit: "text-amber-300",
};

function buildQuery(filters: QueryFilters): string {
  const params = new URLSearchParams();
  if (filters.invoiceNumber.trim()) params.set("invoiceNumber", filters.invoiceNumber.trim());
  if (filters.supplierId) params.set("supplierId", filters.supplierId);
  if (filters.paymentType) params.set("paymentType", filters.paymentType);
  if (filters.createdByUserId) params.set("createdByUserId", filters.createdByUserId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoiceCreators, setInvoiceCreators] = useState<BranchUser[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [createdByUserId, setCreatedByUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const activeQuery: QueryFilters = {
    invoiceNumber,
    supplierId,
    paymentType,
    createdByUserId,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
  };

  const loadPurchases = useCallback(async (query: QueryFilters) => {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await apiJson<{
      purchases: Purchase[];
      invoiceCreators?: BranchUser[];
      message?: string;
    }>(`/api/purchases${buildQuery(query)}`);
    if (ok) {
      setPurchases(data.purchases || []);
      setInvoiceCreators(data.invoiceCreators || []);
    } else {
      setPurchases([]);
      setInvoiceCreators([]);
      setLoadError(data.message || "تعذر تحميل فواتير المشتريات");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    apiJson<{ suppliers: Supplier[] }>("/api/suppliers").then(({ ok, data }) => {
      if (ok) setSuppliers(data.suppliers || []);
    });
  }, []);

  useEffect(() => {
    void loadPurchases(activeQuery);
  }, [
    invoiceNumber,
    supplierId,
    paymentType,
    createdByUserId,
    appliedDates.dateFrom,
    appliedDates.dateTo,
    loadPurchases,
  ]);

  const applyDateFilters = () => {
    setAppliedDates({ dateFrom, dateTo });
  };

  const resetFilters = () => {
    setInvoiceNumber("");
    setSupplierId("");
    setPaymentType("");
    setCreatedByUserId("");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
  };

  const hasActiveFilters = Boolean(
    invoiceNumber.trim() ||
      supplierId ||
      paymentType ||
      createdByUserId ||
      appliedDates.dateFrom ||
      appliedDates.dateTo
  );

  const hasPendingDateFilters =
    dateFrom !== appliedDates.dateFrom || dateTo !== appliedDates.dateTo;

  return (
    <>
      <PageHeader
        title="استعراض فواتير المشتريات"
        subtitle="بحث وعرض فواتير شراء البضاعة من الموردين"
        action={{ label: "فاتورة شراء جديدة", href: "/dashboard/purchases/new" }}
      />

      <div className="glass-card p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-white">تصفية الفواتير</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            <label className="block text-xs text-muted mb-1.5">نوع الدفع</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="glass-input text-sm"
            >
              <option value="">— الكل —</option>
              <option value="full_cash">دفع كلي</option>
              <option value="credit">أجل</option>
              <option value="partial_credit">أجل جزئي</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">الحساب</label>
            <select
              value={createdByUserId}
              onChange={(e) => setCreatedByUserId(e.target.value)}
              className="glass-input text-sm"
            >
              <option value="">— كل الحسابات —</option>
              {invoiceCreators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                  {u.fullNameAr ? ` — ${u.fullNameAr}` : ""}
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

      {loadError ? (
        <div className="glass-card p-4 mb-4 border border-red-500/30 text-red-300 text-sm">
          {loadError}
        </div>
      ) : null}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.supplier} className="text-right p-4 font-medium">
                  المورد
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  التاريخ / الوقت
                </ThEmoji>
                <ThEmoji emoji="💳" className="text-right p-4 font-medium">
                  نوع الدفع
                </ThEmoji>
                <ThEmoji emoji="💵" className="text-right p-4 font-medium">
                  حالة السداد
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  الإجمالي
                </ThEmoji>
                <th className="text-right p-4 font-medium">المرتجع</th>
                <th className="text-right p-4 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    جاري التحميل...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted">
                    {hasActiveFilters ? "لا توجد فواتير مطابقة للفلتر" : "لا توجد فواتير مشتريات"}
                    {!hasActiveFilters && (
                      <Link
                        href="/dashboard/purchases/new"
                        className="block text-primary-light text-sm mt-2 hover:underline"
                      >
                        + إنشاء فاتورة شراء
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="p-4 text-sm font-semibold text-primary-light">
                      <InvoiceNumberWithCreator
                        invoiceNumber={p.invoiceNumber}
                        creator={p.createdBy}
                        emoji={em.invoice}
                      />
                    </td>
                    <td className="p-4 text-sm text-muted">
                      <CellEmoji emoji={em.supplier}>{p.supplier.nameAr}</CellEmoji>
                    </td>
                    <td className="p-4">
                      <CellEmoji emoji={em.date}>
                        <DocumentDateTimeStack value={p.purchaseDate} />
                      </CellEmoji>
                    </td>
                    <td className="p-4 text-sm">{p.paymentTypeLabel}</td>
                    <td className="p-4 text-sm">
                      <span className={settlementToneClass[p.settlementTone] || "text-muted"}>
                        {p.settlementLabel}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-white">
                      <CellEmoji emoji={em.total}>{formatCurrency(p.total)} ج.م</CellEmoji>
                    </td>
                    <td className="p-4">
                      {p.returnStatus && p.returnStatus !== "none" ? (
                        <span className={returnStatusMap[p.returnStatus]?.class || ""}>
                          {returnStatusMap[p.returnStatus]?.label || p.returnStatus}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/dashboard/purchases/${p.id}`}
                        className="inline-flex px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-border text-primary-light hover:bg-primary/15 hover:border-primary/30 transition-colors"
                      >
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
