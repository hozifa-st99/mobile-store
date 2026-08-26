"use client";

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import ReportCatalogTypeFilter, { type CatalogTypeFilter } from "@/components/reports/ReportCatalogTypeFilter";
import ReportTableShell, { CellEmoji, ThEmoji } from "@/components/reports/ReportTableShell";
import { em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";

type InventoryFilter = "all" | "low" | "out" | "stagnant";

interface InventorySummary {
  stockValue: number;
  skuCount: number;
  unitCount: number;
  lowCount: number;
  outCount: number;
  stagnantCount: number;
}

interface InventoryItem {
  productId: string;
  name: string;
  barcode: string | null;
  typeLabel: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  stockValue: number;
  status: string;
}

interface InventoryReportModalProps {
  open: boolean;
  onClose: () => void;
  initialFilter?: InventoryFilter;
}

const primaryMetrics = [
  {
    key: "stockValue" as const,
    label: "قيمة المخزون الحالية",
    emoji: em.total,
    format: "currency" as const,
    cardClass:
      "border-emerald-500/35 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
    valueClass: "text-emerald-300",
    emojiClass: "bg-emerald-500/20",
  },
  {
    key: "skuCount" as const,
    label: "عدد الأصناف",
    emoji: em.category,
    format: "number" as const,
    cardClass:
      "border-indigo-500/35 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent shadow-[0_8px_24px_rgba(99,102,241,0.12)]",
    valueClass: "text-indigo-300",
    emojiClass: "bg-indigo-500/20",
  },
  {
    key: "unitCount" as const,
    label: "عدد الوحدات",
    emoji: em.quantity,
    format: "number" as const,
    cardClass:
      "border-violet-500/35 bg-gradient-to-br from-violet-500/20 via-violet-500/5 to-transparent shadow-[0_8px_24px_rgba(139,92,246,0.12)]",
    valueClass: "text-violet-300",
    emojiClass: "bg-violet-500/20",
  },
];

const alertMetrics = [
  {
    key: "lowCount" as const,
    label: "تحت الحد الأدنى",
    emoji: em.minQuantity,
    filter: "low" as const,
    cardClass:
      "border-amber-400/45 bg-gradient-to-br from-amber-500/18 via-amber-500/5 to-transparent hover:border-amber-300/70 hover:from-amber-500/25",
    valueClass: "text-amber-300",
    badgeClass: "bg-amber-500/20 text-amber-200",
  },
  {
    key: "outCount" as const,
    label: "أصناف نافدة",
    emoji: em.warning,
    filter: "out" as const,
    cardClass:
      "border-red-500/45 bg-gradient-to-br from-red-500/18 via-red-500/5 to-transparent hover:border-red-400/70 hover:from-red-500/25",
    valueClass: "text-red-300",
    badgeClass: "bg-red-500/20 text-red-200",
  },
  {
    key: "stagnantCount" as const,
    label: "أصناف راكدة",
    emoji: em.cycle,
    filter: "stagnant" as const,
    cardClass:
      "border-orange-500/45 bg-gradient-to-br from-orange-500/18 via-orange-500/5 to-transparent hover:border-orange-400/70 hover:from-orange-500/25",
    valueClass: "text-orange-300",
    badgeClass: "bg-orange-500/20 text-orange-200",
  },
];

const filterLabels: Record<InventoryFilter, string> = {
  all: "كل الأصناف",
  low: "تحت الحد الأدنى",
  out: "نافدة",
  stagnant: "أصناف راكدة",
};

export default function InventoryReportModal({
  open,
  onClose,
  initialFilter = "all",
}: InventoryReportModalProps) {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CatalogTypeFilter>("");
  const [listFilter, setListFilter] = useState<InventoryFilter>(initialFilter);
  const [view, setView] = useState<"summary" | "table">(initialFilter === "all" ? "summary" : "table");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", listFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/reports/inventory?${params}`, { credentials: "include" });
      const json = await res.json();
      setSummary(json.summary);
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }, [listFilter, typeFilter, search]);

  useEffect(() => {
    if (!open) return;
    setListFilter(initialFilter);
    setView(initialFilter === "all" ? "summary" : "table");
  }, [open, initialFilter]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, load, search]);

  const openTable = (filter: InventoryFilter) => {
    setListFilter(filter);
    setView("table");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={view === "summary" ? "تقرير المخزون" : filterLabels[listFilter]}
      titleHint={
        view === "table" && listFilter === "stagnant"
          ? "(أصناف راكدة لمدة 90 يوم بدون مبيع)"
          : undefined
      }
      size="xl"
    >
      {loading && !summary ? (
        <div className="py-16 text-center text-muted font-semibold animate-pulse">جاري التحميل...</div>
      ) : view === "summary" && summary ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {primaryMetrics.map((metric) => (
              <div
                key={metric.key}
                className={`rounded-2xl border p-4 ${metric.cardClass}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white/80">{metric.label}</span>
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${metric.emojiClass}`}
                  >
                    {metric.emoji}
                  </span>
                </div>
                <p className={`mt-3 text-2xl font-extrabold ${metric.valueClass}`}>
                  {metric.format === "currency"
                    ? `${formatCurrency(summary[metric.key])} ج.م`
                    : summary[metric.key]}
                </p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-bold text-muted mb-2 px-1">اضغط على أي بطاقة لعرض الأصناف</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {alertMetrics.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => openTable(metric.filter)}
                  className={`group rounded-2xl border p-4 text-start transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${metric.cardClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{metric.label}</span>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${metric.badgeClass}`}
                    >
                      {metric.emoji}
                    </span>
                  </div>
                  <p className={`mt-3 text-2xl font-extrabold ${metric.valueClass}`}>
                    {summary[metric.key]}
                  </p>
                  <p className="mt-3 text-xs font-bold text-white/70 group-hover:text-white transition-colors inline-flex items-center gap-1">
                    عرض الأصناف
                    <span aria-hidden>←</span>
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => openTable("all")} className="btn-primary w-full py-3">
            عرض كل الأصناف
          </button>
        </div>
      ) : (
        <ReportTableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالاسم أو الباركود..."
          filterSlot={<ReportCatalogTypeFilter value={typeFilter} onChange={setTypeFilter} />}
          toolbarExtra={
            <button type="button" onClick={() => setView("summary")} className="btn-secondary px-4 py-2 text-xs">
              الملخص
            </button>
          }
          isEmpty={!loading && items.length === 0}
        >
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border/40 bg-white/[0.02]">
                <ThEmoji emoji={em.product} className="px-4 py-3 text-start">
                  الصنف
                </ThEmoji>
                <ThEmoji emoji={em.category} className="px-4 py-3 text-start">
                  الفئة
                </ThEmoji>
                <ThEmoji emoji={em.type} className="px-4 py-3 text-start">
                  النوع
                </ThEmoji>
                <ThEmoji emoji={em.quantity} className="px-4 py-3 text-start">
                  الكمية
                </ThEmoji>
                <ThEmoji emoji={em.purchasePrice} className="px-4 py-3 text-start">
                  التكلفة
                </ThEmoji>
                <ThEmoji emoji={em.total} className="px-4 py-3 text-start">
                  قيمة المخزون
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.productId} className="border-b border-border/30 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <CellEmoji emoji={em.product}>
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        {item.barcode && (
                          <div className="text-xs text-muted mt-0.5">{item.barcode}</div>
                        )}
                      </div>
                    </CellEmoji>
                  </td>
                  <td className="px-4 py-3 table-cell-muted">{item.category}</td>
                  <td className="px-4 py-3 table-cell-muted">{item.typeLabel}</td>
                  <td className="px-4 py-3 table-cell-strong">
                    <CellEmoji emoji={em.quantity}>{item.quantity}</CellEmoji>
                  </td>
                  <td className="px-4 py-3 table-cell-strong">
                    {formatCurrency(item.unitCost)} ج.م
                  </td>
                  <td className="px-4 py-3 table-cell-strong">
                    {formatCurrency(item.stockValue)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportTableShell>
      )}
    </Modal>
  );
}
