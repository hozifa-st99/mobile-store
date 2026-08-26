"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { formatCurrency } from "@/lib/utils";
import { formatStocktakeAdjustmentAmount } from "@/lib/stocktake-line-utils";
import { apiJson } from "@/lib/api-client";

type DocumentType =
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sale_return"
  | "stock_entry"
  | "stocktake"
  | "all";

interface DocumentRow {
  id: string;
  type: DocumentType;
  typeLabel: string;
  documentNumber: string;
  date: string;
  partyName: string;
  total: number;
  status: string | null;
  parentDocumentNumber: string | null;
  detailUrl: string;
}

interface QueryFilters {
  documentNumber: string;
  type: DocumentType;
  dateFrom: string;
  dateTo: string;
}

const typeOptions: { value: DocumentType; label: string }[] = [
  { value: "all", label: "— الكل —" },
  { value: "purchase", label: "فاتورة مشتريات" },
  { value: "purchase_return", label: "مرتجع مشتريات" },
  { value: "sale", label: "فاتورة مبيعات" },
  { value: "sale_return", label: "مرتجع مبيعات" },
  { value: "stock_entry", label: "إدخال رصيد / بضاعة موجودة" },
  { value: "stocktake", label: "تسوية / جرد" },
];

const typeBadgeClass: Record<DocumentType, string> = {
  all: "",
  purchase: "bg-primary/15 text-primary-light border-primary/30",
  purchase_return: "bg-accent-orange/15 text-accent-orange border-accent-orange/30",
  sale: "bg-accent-green/15 text-accent-green border-accent-green/30",
  sale_return: "bg-accent-orange/15 text-accent-orange border-accent-orange/30",
  stock_entry: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  stocktake: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const statusMap: Record<string, { label: string; class: string }> = {
  completed: { label: "مكتمل", class: "status-complete" },
  pending: { label: "قيد الانتظار", class: "status-pending" },
};

function buildQuery(filters: QueryFilters): string {
  const params = new URLSearchParams();
  if (filters.documentNumber.trim()) {
    params.set("documentNumber", filters.documentNumber.trim());
  }
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentNumber, setDocumentNumber] = useState("");
  const [type, setType] = useState<DocumentType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ dateFrom: "", dateTo: "" });
  const [loading, setLoading] = useState(true);

  const activeQuery: QueryFilters = {
    documentNumber,
    type,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
  };

  const loadDocuments = useCallback(async (query: QueryFilters) => {
    setLoading(true);
    const { ok, data } = await apiJson<{ documents: DocumentRow[] }>(
      `/api/documents${buildQuery(query)}`
    );
    if (ok) setDocuments(data.documents || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDocuments(activeQuery);
  }, [documentNumber, type, appliedDates.dateFrom, appliedDates.dateTo, loadDocuments]);

  const applyDateFilters = () => {
    setAppliedDates({ dateFrom, dateTo });
  };

  const resetFilters = () => {
    setDocumentNumber("");
    setType("all");
    setDateFrom("");
    setDateTo("");
    setAppliedDates({ dateFrom: "", dateTo: "" });
  };

  const hasActiveFilters = Boolean(
    documentNumber.trim() || type !== "all" || appliedDates.dateFrom || appliedDates.dateTo
  );

  const hasPendingDateFilters =
    dateFrom !== appliedDates.dateFrom || dateTo !== appliedDates.dateTo;

  return (
    <>
      <PageHeader
        title="سجل الحركات"
        subtitle="فواتير المبيعات والمشتريات ومرتجعاتها — إدخال الرصيد — تسوية / جرد"
      />

      <div className="glass-card p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-white">تصفية السجل</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">رقم المستند</label>
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="PUR / SAL / STK / OB..."
              className="glass-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">نوع المستند</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="glass-input text-sm"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم المستند
                </ThEmoji>
                <ThEmoji emoji={em.type} className="text-right p-4 font-medium">
                  النوع
                </ThEmoji>
                <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                  الطرف
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  التاريخ / الوقت
                </ThEmoji>
                <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                  المبلغ
                </ThEmoji>
                <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                  الحالة
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
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted text-sm">
                    لا توجد مستندات
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const badge = typeBadgeClass[doc.type];
                  const st = doc.status ? statusMap[doc.status] : null;
                  return (
                    <tr key={`${doc.type}-${doc.id}`} className="border-b border-border/40">
                      <td className="p-4">
                        <CellEmoji emoji={em.invoice}>
                          <span className="text-sm font-semibold text-primary-light">
                            {doc.documentNumber}
                          </span>
                        </CellEmoji>
                        {doc.parentDocumentNumber && (
                          <p className="text-[11px] text-muted-dark mt-1 mr-6">
                            على: {doc.parentDocumentNumber}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge}`}
                        >
                          {doc.typeLabel}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-white">{doc.partyName}</td>
                      <td className="p-4">
                        <DocumentDateTimeStack value={doc.date} />
                      </td>
                      <td className="p-4 text-sm font-semibold tabular-nums">
                        {doc.type === "stocktake"
                          ? `${formatStocktakeAdjustmentAmount(doc.total)} ج.م`
                          : `${formatCurrency(doc.total)} ج.م`}
                      </td>
                      <td className="p-4 text-sm">
                        {st ? (
                          <span className={st.class}>{st.label}</span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Link
                          href={doc.detailUrl}
                          className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 border border-primary/30 text-primary-light hover:bg-primary/25"
                        >
                          عرض
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && documents.length > 0 && (
          <p className="p-3 text-xs text-muted border-t border-border/40">
            {documents.length} مستند — مرتّبة من الأحدث
          </p>
        )}
      </div>
    </>
  );
}
