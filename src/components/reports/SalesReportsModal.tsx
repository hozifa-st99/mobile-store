"use client";

import { useCallback, useEffect, useState } from "react";

import type { ReportFilterState } from "@/components/reports/ReportDateFilter";
import Modal from "@/components/ui/Modal";
import ReportCatalogTypeFilter, { type CatalogTypeFilter } from "@/components/reports/ReportCatalogTypeFilter";
import ReportTableShell, { CellEmoji, ThEmoji } from "@/components/reports/ReportTableShell";
import { em } from "@/components/ui/TableEmoji";
import { appendReportQuery } from "@/lib/report-query";
import { formatCurrency } from "@/lib/utils";

interface ProductRow {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
  margin: number;
}

interface CategoryRow {
  category: string;
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
  share: number;
}

interface SalesSummaryDisplay {
  grossTotal: number;
  returnsTotal: number;
  netTotal: number;
}

interface SalesReportsModalProps {
  open: boolean;
  onClose: () => void;
  filter: ReportFilterState;
  initialTab?: "products" | "categories";
  salesSummary?: SalesSummaryDisplay;
}

const RETURN_EMOJI = "↩️";

function SalesSummaryCircles({ summary }: { summary: SalesSummaryDisplay }) {
  const items = [
    {
      label: "إجمالي المبيعات",
      value: `${formatCurrency(summary.grossTotal)} ج.م`,
      emoji: em.salePrice,
      ring: "ring-emerald-400/35",
      bg: "bg-emerald-500/15",
      iconBg: "bg-emerald-500/25 ring-emerald-400/30",
      text: "text-emerald-200",
      labelText: "text-emerald-300/90",
    },
    {
      label: "مرتجعات المبيعات",
      value: `${formatCurrency(summary.returnsTotal)} ج.م`,
      emoji: RETURN_EMOJI,
      ring: "ring-amber-400/35",
      bg: "bg-amber-500/15",
      iconBg: "bg-amber-500/25 ring-amber-400/30",
      text: "text-amber-200",
      labelText: "text-amber-300/90",
    },
    {
      label: "صافي المبيعات",
      value: `${formatCurrency(summary.netTotal)} ج.م`,
      emoji: em.profitUp,
      ring: "ring-sky-400/35",
      bg: "bg-sky-500/15",
      iconBg: "bg-sky-500/25 ring-sky-400/30",
      text: "text-sky-200",
      labelText: "text-sky-300/90",
    },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          title={item.label}
          className={`inline-flex items-center gap-2 rounded-full ps-1 pe-3 py-1 ring-1 ${item.ring} ${item.bg}`}
        >
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ring-1 ${item.iconBg}`}
            aria-hidden
          >
            {item.emoji}
          </span>
          <span className="flex flex-col min-w-0 leading-tight">
            <span className={`text-[10px] font-bold ${item.labelText}`}>{item.label}</span>
            <span className={`text-xs font-extrabold tabular-nums ${item.text}`}>{item.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const highlightBlocks = [
  {
    key: "topByQuantity" as const,
    title: "أكثر مبيعًا (كمية)",
    emoji: em.quantity,
    metric: "quantity" as const,
    cardClass:
      "border-emerald-500/35 bg-gradient-to-br from-emerald-500/20 via-emerald-500/6 to-transparent shadow-[0_10px_28px_rgba(16,185,129,0.14)]",
    titleClass: "text-emerald-300",
    emojiClass: "bg-emerald-500/22 ring-1 ring-emerald-400/25",
    valueClass: "text-emerald-200",
    highlightHeadClass: "bg-emerald-500/30 text-emerald-100 ring-1 ring-inset ring-emerald-400/35",
    highlightCellClass: "bg-emerald-500/18 text-emerald-100 font-extrabold ring-1 ring-inset ring-emerald-400/20",
  },
  {
    key: "topBySales" as const,
    title: "أكثر تحقيقًا للمبيعات",
    emoji: em.salePrice,
    metric: "sales" as const,
    cardClass:
      "border-blue-500/35 bg-gradient-to-br from-blue-500/20 via-blue-500/6 to-transparent shadow-[0_10px_28px_rgba(59,130,246,0.14)]",
    titleClass: "text-blue-300",
    emojiClass: "bg-blue-500/22 ring-1 ring-blue-400/25",
    valueClass: "text-blue-200",
    highlightHeadClass: "bg-blue-500/30 text-blue-100 ring-1 ring-inset ring-blue-400/35",
    highlightCellClass: "bg-blue-500/18 text-blue-100 font-extrabold ring-1 ring-inset ring-blue-400/20",
  },
  {
    key: "topByProfit" as const,
    title: "أكثر تحقيقًا للربح",
    emoji: em.profitUp,
    metric: "profit" as const,
    cardClass:
      "border-teal-500/35 bg-gradient-to-br from-teal-500/20 via-teal-500/6 to-transparent shadow-[0_10px_28px_rgba(20,184,166,0.14)]",
    titleClass: "text-teal-300",
    emojiClass: "bg-teal-500/22 ring-1 ring-teal-400/25",
    valueClass: "text-teal-200",
    highlightHeadClass: "bg-teal-500/30 text-teal-100 ring-1 ring-inset ring-teal-400/35",
    highlightCellClass: "bg-teal-500/18 text-teal-100 font-extrabold ring-1 ring-inset ring-teal-400/20",
  },
  {
    key: "leastMovement" as const,
    title: "أقل حركة",
    emoji: em.profitDown,
    metric: "quantity" as const,
    cardClass:
      "border-orange-500/35 bg-gradient-to-br from-orange-500/20 via-orange-500/6 to-transparent shadow-[0_10px_28px_rgba(249,115,22,0.14)]",
    titleClass: "text-orange-300",
    emojiClass: "bg-orange-500/22 ring-1 ring-orange-400/25",
    valueClass: "text-orange-200",
    highlightHeadClass: "bg-orange-500/30 text-orange-100 ring-1 ring-inset ring-orange-400/35",
    highlightCellClass: "bg-orange-500/18 text-orange-100 font-extrabold ring-1 ring-inset ring-orange-400/20",
  },
];

const HIGHLIGHT_PREVIEW_COUNT = 3;
const HIGHLIGHT_DETAIL_COUNT = 25;

type HighlightKey = (typeof highlightBlocks)[number]["key"];

function sortProductsForHighlight(items: ProductRow[], key: HighlightKey): ProductRow[] {
  const sorted = [...items];
  if (key === "topByQuantity") sorted.sort((a, b) => b.quantity - a.quantity);
  else if (key === "topBySales") sorted.sort((a, b) => b.sales - a.sales);
  else if (key === "topByProfit") sorted.sort((a, b) => b.profit - a.profit);
  else sorted.sort((a, b) => a.quantity - b.quantity);
  return sorted.slice(0, HIGHLIGHT_DETAIL_COUNT);
}

function formatHighlightValue(
  metric: "quantity" | "sales" | "profit",
  row: ProductRow
): string {
  if (metric === "quantity") return String(row.quantity);
  if (metric === "profit") return `${formatCurrency(row.profit)} ج.م`;
  return `${formatCurrency(row.sales)} ج.م`;
}

export default function SalesReportsModal({
  open,
  onClose,
  filter,
  initialTab = "products",
  salesSummary,
}: SalesReportsModalProps) {
  const [tab, setTab] = useState<"products" | "categories">(initialTab);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [highlights, setHighlights] = useState<{
    topByQuantity: ProductRow[];
    topBySales: ProductRow[];
    topByProfit: ProductRow[];
    leastMovement: ProductRow[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CatalogTypeFilter>("");
  const [detailBlock, setDetailBlock] = useState<(typeof highlightBlocks)[number] | null>(null);

  useEffect(() => {
    if (!open) setDetailBlock(null);
  }, [open]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const base = appendReportQuery("/api/reports/sales-products", filter);
      const params = new URLSearchParams(base.split("?")[1] || "");
      if (typeFilter) params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/reports/sales-products?${params}`, { credentials: "include" });
      const json = await res.json();
      setProducts(json.products || []);
      setHighlights(json.highlights || null);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, search]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const base = appendReportQuery("/api/reports/sales-categories", filter);
      const params = new URLSearchParams(base.split("?")[1] || "");
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/reports/sales-categories?${params}`, { credentials: "include" });
      const json = await res.json();
      setCategories(json.categories || []);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (tab === "products") loadProducts();
      else loadCategories();
    }, search && tab === "products" ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, tab, loadProducts, loadCategories, search]);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="تقارير المبيعات"
      size="xl"
      titleAddon={salesSummary ? <SalesSummaryCircles summary={salesSummary} /> : null}
    >
      <div className="flex gap-2 mb-4">
        {(
          [
            { id: "products" as const, label: "حسب الأصناف", emoji: em.product },
            { id: "categories" as const, label: "حسب الفئات", emoji: em.category },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === item.id
                ? "bg-accent-green/20 text-white border border-accent-green/40"
                : "border border-border text-muted hover:text-white"
            }`}
          >
            <span>{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <div className="space-y-4">
          {highlights && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {highlightBlocks.map((block) => {
                const rows = highlights[block.key];
                return (
                  <div key={block.key} className={`rounded-2xl border p-4 ${block.cardClass}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h4
                        className={`text-sm font-bold inline-flex items-center gap-2 ${block.titleClass}`}
                      >
                        {block.title}
                      </h4>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg ${block.emojiClass}`}
                        >
                          {block.emoji}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetailBlock(block)}
                          title="عرض 25 صنف"
                          aria-label={`عرض 25 صنف — ${block.title}`}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all hover:scale-105 bg-white/10 ring-1 ring-white/15 hover:ring-white/30 ${block.titleClass}`}
                        >
                          {em.view}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {rows.slice(0, HIGHLIGHT_PREVIEW_COUNT).map((row, index) => (
                        <div
                          key={row.productId}
                          className="flex items-center justify-between gap-2 rounded-xl bg-black/15 px-3 py-2 ring-1 ring-white/5"
                        >
                          <span className="text-xs text-white/75 truncate max-w-[62%]">
                            <span className="text-white/40 me-1">{index + 1}.</span>
                            {row.name}
                          </span>
                          <span className={`text-xs font-bold shrink-0 ${block.valueClass}`}>
                            {formatHighlightValue(block.metric, row)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <ReportTableShell
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="بحث بالاسم أو الباركود..."
            filterSlot={<ReportCatalogTypeFilter value={typeFilter} onChange={setTypeFilter} />}
            isEmpty={!loading && products.length === 0}
            emptyMessage={loading ? "جاري التحميل..." : "لا توجد مبيعات في هذه الفترة"}
          >
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border/40 bg-white/[0.02]">
                  <ThEmoji emoji={em.product} className="px-3 py-3 text-start">الصنف</ThEmoji>
                  <ThEmoji emoji={em.category} className="px-3 py-3 text-start">الفئة</ThEmoji>
                  <ThEmoji emoji={em.quantity} className="px-3 py-3 text-start">الكمية</ThEmoji>
                  <ThEmoji emoji={em.salePrice} className="px-3 py-3 text-start">المبيعات</ThEmoji>
                  <ThEmoji emoji={em.purchasePrice} className="px-3 py-3 text-start">التكلفة</ThEmoji>
                  <ThEmoji emoji={em.profitUp} className="px-3 py-3 text-start">الربح</ThEmoji>
                  <ThEmoji emoji={em.status} className="px-3 py-3 text-start">الهامش</ThEmoji>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.productId} className="border-b border-border/30 hover:bg-white/[0.02]">
                    <td className="px-3 py-3 table-cell-strong">
                      <CellEmoji emoji={em.product}>{row.name}</CellEmoji>
                    </td>
                    <td className="px-3 py-3 table-cell-muted">{row.category}</td>
                    <td className="px-3 py-3">{row.quantity}</td>
                    <td className="px-3 py-3">{formatCurrency(row.sales)} ج.م</td>
                    <td className="px-3 py-3">{formatCurrency(row.cost)} ج.م</td>
                    <td className="px-3 py-3">{formatCurrency(row.profit)} ج.م</td>
                    <td className="px-3 py-3">{row.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportTableShell>
        </div>
      ) : (
        <ReportTableShell
          search=""
          onSearchChange={() => {}}
          filterSlot={<ReportCatalogTypeFilter value={typeFilter} onChange={setTypeFilter} />}
          isEmpty={!loading && categories.length === 0}
          emptyMessage={loading ? "جاري التحميل..." : "لا توجد مبيعات في هذه الفترة"}
        >
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border/40 bg-white/[0.02]">
                <ThEmoji emoji={em.category} className="px-4 py-3 text-start">الفئة</ThEmoji>
                <ThEmoji emoji={em.quantity} className="px-4 py-3 text-start">الكمية</ThEmoji>
                <ThEmoji emoji={em.salePrice} className="px-4 py-3 text-start">المبيعات</ThEmoji>
                <ThEmoji emoji={em.purchasePrice} className="px-4 py-3 text-start">التكلفة</ThEmoji>
                <ThEmoji emoji={em.profitUp} className="px-4 py-3 text-start">الربح</ThEmoji>
                <ThEmoji emoji={em.status} className="px-4 py-3 text-start">نسبة المبيعات</ThEmoji>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr key={row.category} className="border-b border-border/30 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 table-cell-strong">
                    <CellEmoji emoji={em.category}>{row.category}</CellEmoji>
                  </td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3">{formatCurrency(row.sales)} ج.م</td>
                  <td className="px-4 py-3">{formatCurrency(row.cost)} ج.م</td>
                  <td className="px-4 py-3">{formatCurrency(row.profit)} ج.م</td>
                  <td className="px-4 py-3">{row.share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportTableShell>
      )}
    </Modal>

    {detailBlock && (
      <Modal
        open
        onClose={() => setDetailBlock(null)}
        title={detailBlock.title}
        titleHint={
          detailBlock.key === "leastMovement"
            ? `أقل ${HIGHLIGHT_DETAIL_COUNT} صنف حركة`
            : `أعلى ${HIGHLIGHT_DETAIL_COUNT} صنف`
        }
        size="xl"
      >
        <div className={`rounded-2xl border p-3 mb-4 ${detailBlock.cardClass}`}>
          <p className={`text-xs font-semibold ${detailBlock.titleClass}`}>
            {em.view} عرض تفصيلي — {detailBlock.title}
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 overflow-hidden bg-background-card/30">
          <div className="overflow-x-auto max-h-[min(58dvh,520px)] overflow-y-auto">
            <table className="w-full min-w-[820px]">
              <thead className="sticky top-0 z-[1] bg-background-card/95 backdrop-blur-sm">
                <tr className="border-b border-border/40">
                  <ThEmoji emoji={em.number} className="px-3 py-3 text-start w-12">
                    #
                  </ThEmoji>
                  <ThEmoji emoji={em.product} className="px-3 py-3 text-start">
                    الصنف
                  </ThEmoji>
                  <ThEmoji emoji={em.category} className="px-3 py-3 text-start">
                    الفئة
                  </ThEmoji>
                  <ThEmoji emoji={em.quantity} className="px-3 py-3 text-start">
                    الكمية
                  </ThEmoji>
                  <ThEmoji emoji={em.salePrice} className="px-3 py-3 text-start">
                    المبيعات
                  </ThEmoji>
                  <ThEmoji emoji={em.profitUp} className="px-3 py-3 text-start">
                    الربح
                  </ThEmoji>
                  <th
                    className={`px-3 py-3 text-start text-xs font-bold ${detailBlock.highlightHeadClass}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{em.status}</span>
                      {detailBlock.metric === "quantity"
                        ? "معيار الكارت — الكمية"
                        : detailBlock.metric === "profit"
                          ? "معيار الكارت — الربح"
                          : "معيار الكارت — المبيعات"}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortProductsForHighlight(products, detailBlock.key).map((row, index) => (
                  <tr key={row.productId} className="border-b border-border/30 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5 text-xs font-bold text-muted">{index + 1}</td>
                    <td className="px-3 py-2.5 table-cell-strong">
                      <CellEmoji emoji={em.product}>{row.name}</CellEmoji>
                    </td>
                    <td className="px-3 py-2.5 table-cell-muted text-sm">{row.category}</td>
                    <td className="px-3 py-2.5 text-sm">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-sm">{formatCurrency(row.sales)} ج.م</td>
                    <td className="px-3 py-2.5 text-sm">{formatCurrency(row.profit)} ج.م</td>
                    <td className={`px-3 py-2.5 text-sm ${detailBlock.highlightCellClass}`}>
                      {formatHighlightValue(detailBlock.metric, row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
}
