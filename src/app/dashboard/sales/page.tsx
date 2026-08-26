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

interface Customer {
  id: string;
  nameAr: string;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: string;
  returnStatus?: string;
  total: number;
  paymentMethod: string;
  customer?: { nameAr: string } | null;
  createdBy?: InvoiceCreatorInfo | null;
}

interface BranchUser extends InvoiceCreatorInfo {}

interface QueryFilters {
  invoiceNumber: string;
  customerId: string;
  createdByUserId: string;
  dateFrom: string;
  dateTo: string;
}

const statusMap: Record<string, { label: string; class: string }> = {
  completed: { label: "مكتمل", class: "status-complete" },
  pending: { label: "قيد الانتظار", class: "status-pending" },
  cancelled: {
    label: "ملغي",
    class: "px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20",
  },
};

const returnStatusMap: Record<string, { label: string; class: string }> = {
  partial: { label: "مرتجع جزئي", class: "status-pending" },
  full: { label: "مرتجع كامل", class: "status-complete" },
};

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};

function buildQuery(filters: QueryFilters): string {
  const params = new URLSearchParams();
  if (filters.invoiceNumber.trim()) params.set("invoiceNumber", filters.invoiceNumber.trim());
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.createdByUserId) params.set("createdByUserId", filters.createdByUserId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoiceCreators, setInvoiceCreators] = useState<BranchUser[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [createdByUserId, setCreatedByUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const activeQuery: QueryFilters = {
    invoiceNumber,
    customerId,
    createdByUserId,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
  };

  const loadSales = useCallback(async (query: QueryFilters) => {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await apiJson<{ sales: Sale[]; invoiceCreators?: BranchUser[]; message?: string }>(
      `/api/sales${buildQuery(query)}`
    );
    if (ok) {
      setSales(data.sales || []);
      setInvoiceCreators(data.invoiceCreators || []);
    } else {
      setSales([]);
      setInvoiceCreators([]);
      setLoadError(data.message || "تعذر تحميل فواتير المبيعات");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    apiJson<{ customers: Customer[] }>("/api/customers").then(({ ok, data }) => {
      if (ok) setCustomers(data.customers || []);
    });
  }, []);

  useEffect(() => {
    void loadSales(activeQuery);
  }, [invoiceNumber, customerId, createdByUserId, appliedDates.dateFrom, appliedDates.dateTo, loadSales]);

  const applyDateFilters = () => {
    setAppliedDates({ dateFrom, dateTo });
  };

  const resetFilters = () => {
    setInvoiceNumber("");
    setCustomerId("");
    setCreatedByUserId("");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
  };

  const hasActiveFilters = Boolean(
    invoiceNumber.trim() ||
      customerId ||
      createdByUserId ||
      appliedDates.dateFrom ||
      appliedDates.dateTo
  );

  const hasPendingDateFilters =
    dateFrom !== appliedDates.dateFrom || dateTo !== appliedDates.dateTo;

  return (
    <>
      <PageHeader
        title="استعراض فواتير المبيعات"
        subtitle="بحث وعرض فواتير البيع"
        action={{ label: "فاتورة بيع جديدة", href: "/dashboard/sales/new" }}
      />

      <div className="glass-card p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-white">تصفية الفواتير</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="min-w-0">
            <label className="block text-xs text-muted mb-1.5 min-h-[1rem] leading-4">رقم الفاتورة</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-..."
              className="glass-input text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-muted mb-1.5 min-h-[1rem] leading-4">العميل</label>
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
          <div className="min-w-0">
            <label className="block text-xs text-muted mb-1.5 min-h-[1rem] leading-4">الحساب</label>
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
          <div className="min-w-0">
            <label className="block text-xs text-muted mb-1.5 min-h-[1rem] leading-4">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="glass-input text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-muted mb-1.5 min-h-[1rem] leading-4">إلى تاريخ</label>
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
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                  العميل
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  التاريخ / الوقت
                </ThEmoji>
                <ThEmoji emoji={em.payment} className="text-right p-4 font-medium">
                  الدفع
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  الإجمالي
                </ThEmoji>
                <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                  الحالة
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
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted">
                    {hasActiveFilters ? "لا توجد فواتير مطابقة للفلتر" : "لا توجد فواتير مبيعات"}
                    {!hasActiveFilters && (
                      <Link
                        href="/dashboard/sales/new"
                        className="block text-primary-light text-sm mt-2 hover:underline"
                      >
                        + إنشاء فاتورة بيع
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="p-4 text-sm font-semibold text-primary-light">
                      <InvoiceNumberWithCreator
                        invoiceNumber={s.invoiceNumber}
                        creator={s.createdBy}
                        emoji={em.invoice}
                      />
                    </td>
                    <td className="p-4 text-sm text-muted">
                      <CellEmoji emoji={em.customer}>
                        {s.customer?.nameAr || "عميل نقدي"}
                      </CellEmoji>
                    </td>
                    <td className="p-4">
                      <CellEmoji emoji={em.date}>
                        <DocumentDateTimeStack value={s.saleDate} />
                      </CellEmoji>
                    </td>
                    <td className="p-4 text-xs text-muted">
                      <CellEmoji emoji={em.payment}>
                        {paymentLabels[s.paymentMethod] || s.paymentMethod}
                      </CellEmoji>
                    </td>
                    <td className="p-4 text-sm font-semibold text-white">
                      <CellEmoji emoji={em.total}>{formatCurrency(s.total)} ج.م</CellEmoji>
                    </td>
                    <td className="p-4">
                      <span className={statusMap[s.status]?.class || "status-pending"}>
                        {statusMap[s.status]?.label || s.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {s.returnStatus && s.returnStatus !== "none" ? (
                        <span className={returnStatusMap[s.returnStatus]?.class || ""}>
                          {returnStatusMap[s.returnStatus]?.label || s.returnStatus}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/dashboard/sales/${s.id}`}
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
