"use client";

import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import ReportTableShell from "@/components/reports/ReportTableShell";
import { CellEmoji, ThEmoji } from "@/components/ui/TableEmoji";
import { em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";

export type BranchInventoryDetailFilter = "out" | "low" | "stagnant" | "fast";

export interface BranchInventoryDetailItem {
  productId: string;
  name: string;
  barcode: string | null;
  typeLabel: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  stockValue: number;
  status: BranchInventoryDetailFilter | "out" | "low" | "stagnant" | "fast";
}

const filterMeta: Record<
  BranchInventoryDetailFilter,
  { title: string; emoji: string; hint?: string }
> = {
  out: { title: "أصناف نافدة", emoji: "⚠️" },
  low: { title: "تحت الحد الأدنى", emoji: "📉" },
  stagnant: {
    title: "أصناف راكدة",
    emoji: "🐢",
    hint: "بدون مبيع خلال آخر 90 يوم",
  },
  fast: { title: "سريعة الحركة", emoji: "⚡", hint: "مباعة خلال آخر 90 يوم" },
};

interface BranchInventoryDetailModalProps {
  open: boolean;
  onClose: () => void;
  branchName: string;
  filter: BranchInventoryDetailFilter;
  items: BranchInventoryDetailItem[];
}

export default function BranchInventoryDetailModal({
  open,
  onClose,
  branchName,
  filter,
  items,
}: BranchInventoryDetailModalProps) {
  const [search, setSearch] = useState("");
  const meta = filterMeta[filter];

  const filtered = useMemo(() => {
    const base = items.filter((item) => item.status === filter);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.barcode?.toLowerCase().includes(q) ?? false) ||
        item.category.toLowerCase().includes(q)
    );
  }, [filter, items, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${meta.emoji} ${meta.title} — ${branchName}`}
      titleHint={meta.hint}
      size="xl"
    >
      <ReportTableShell
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالاسم أو الباركود..."
        isEmpty={filtered.length === 0}
        emptyMessage="لا توجد أصناف في هذه الفئة"
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
              <ThEmoji emoji={em.minQuantity} className="px-4 py-3 text-start">
                الحد الأدنى
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
            {filtered.map((item) => (
              <tr key={item.productId} className="border-b border-border/30 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <CellEmoji emoji={em.product}>
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      {item.barcode ? (
                        <div className="text-xs text-muted mt-0.5">{item.barcode}</div>
                      ) : null}
                    </div>
                  </CellEmoji>
                </td>
                <td className="px-4 py-3 table-cell-muted">{item.category}</td>
                <td className="px-4 py-3 table-cell-muted">{item.typeLabel}</td>
                <td className="px-4 py-3 table-cell-strong">
                  <CellEmoji emoji={em.quantity}>{item.quantity}</CellEmoji>
                </td>
                <td className="px-4 py-3 table-cell-muted tabular-nums">{item.minQuantity}</td>
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
    </Modal>
  );
}
