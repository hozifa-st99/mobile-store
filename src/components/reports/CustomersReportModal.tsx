"use client";

import { useCallback, useEffect, useState } from "react";

import type { ReportFilterState } from "@/components/reports/ReportDateFilter";
import Modal from "@/components/ui/Modal";
import ReportTableShell, { CellEmoji, ThEmoji } from "@/components/reports/ReportTableShell";
import { em } from "@/components/ui/TableEmoji";
import { appendReportQuery } from "@/lib/report-query";
import { formatCurrency } from "@/lib/utils";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  invoiceCount: number;
  totalPurchases: number;
}

interface CustomersReportModalProps {
  open: boolean;
  onClose: () => void;
  filter: ReportFilterState;
}

export default function CustomersReportModal({ open, onClose, filter }: CustomersReportModalProps) {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "total">("total");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = appendReportQuery("/api/reports/customers", filter);
      const params = new URLSearchParams(base.split("?")[1] || "");
      params.set("sort", sort);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/reports/customers?${params}`, { credentials: "include" });
      const json = await res.json();
      setRows(json.customers || []);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, search]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, load, search]);

  return (
    <Modal open={open} onClose={onClose} title="تقرير العملاء" size="xl">
      <ReportTableShell
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالاسم أو رقم الهاتف..."
        sortSlot={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSort("name")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                sort === "name" ? "border-primary/40 bg-primary/15 text-white" : "border-border text-muted"
              }`}
            >
              {em.name} الاسم
            </button>
            <button
              type="button"
              onClick={() => setSort("total")}
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                sort === "total" ? "border-primary/40 bg-primary/15 text-white" : "border-border text-muted"
              }`}
            >
              {em.total} المبلغ
            </button>
          </div>
        }
        isEmpty={!loading && rows.length === 0}
        emptyMessage={loading ? "جاري التحميل..." : "لا يوجد عملاء في هذه الفترة"}
      >
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border/40 bg-white/[0.02]">
              <ThEmoji emoji={em.customer} className="px-4 py-3 text-start">
                العميل
              </ThEmoji>
              <ThEmoji emoji={em.phone} className="px-4 py-3 text-start">
                الهاتف
              </ThEmoji>
              <ThEmoji emoji={em.invoice} className="px-4 py-3 text-start">
                عدد الفواتير
              </ThEmoji>
              <ThEmoji emoji={em.total} className="px-4 py-3 text-start">
                إجمالي المشتريات
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                <td className="px-4 py-3 table-cell-strong">
                  <CellEmoji emoji={em.customer}>{row.name}</CellEmoji>
                </td>
                <td className="px-4 py-3 table-cell-muted">
                  <CellEmoji emoji={em.phone}>{row.phone}</CellEmoji>
                </td>
                <td className="px-4 py-3 table-cell-strong">{row.invoiceCount}</td>
                <td className="px-4 py-3 table-cell-strong">
                  {formatCurrency(row.totalPurchases)} ج.م
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportTableShell>
    </Modal>
  );
}
