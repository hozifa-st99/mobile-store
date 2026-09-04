"use client";

import { useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import { apiJson } from "@/lib/api-client";
import type { InventoryStockValueSnapshot } from "@/lib/inventory-stock-value-display";
import { formatAmountExact, cn } from "@/lib/utils";

interface InventoryStockValueModalProps {
  open: boolean;
  passwordOpen: boolean;
  loading: boolean;
  error: string | null;
  snapshot: InventoryStockValueSnapshot | null;
  onClose: () => void;
  onSubmitPassword: (password: string) => void;
  onClosePassword: () => void;
}

function SummaryCard({
  label,
  value,
  quantity,
  emoji,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  quantity: number;
  emoji: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "rounded-2xl border px-4 py-4 text-right transition-all w-full",
        accent,
        clickable && "hover:brightness-110 cursor-pointer",
        !clickable && "cursor-default",
        active && "ring-2 ring-white/25 scale-[1.01]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted mb-1">{label}</p>
          <p className="text-xl font-bold tabular-nums text-white">
            {formatAmountExact(value)} <span className="text-sm font-medium text-muted">ج.م</span>
          </p>
          {quantity > 0 ? (
            <p className="text-[11px] text-muted mt-1 tabular-nums">{formatAmountExact(quantity)} وحدة</p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function BreakdownTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: InventoryStockValueSnapshot["phonesByBrand"];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background-input/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-white/[0.02]">
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border/40 bg-background-input/30">
                <th className="text-right p-3 font-medium">#</th>
                <th className="text-right p-3 font-medium">الاسم</th>
                <th className="text-right p-3 font-medium">الكمية</th>
                <th className="text-right p-3 font-medium">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                  <td className="p-3 text-muted tabular-nums">{index + 1}</td>
                  <td className="p-3 font-semibold text-white">{row.label}</td>
                  <td className="p-3 tabular-nums text-muted">{formatAmountExact(row.quantity)}</td>
                  <td className="p-3 tabular-nums font-bold text-primary-light">
                    {formatAmountExact(row.value)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-white/[0.03] border-t border-border/50">
                <td colSpan={2} className="p-3 text-sm font-semibold text-white">
                  الإجمالي
                </td>
                <td className="p-3 tabular-nums font-semibold text-white">
                  {formatAmountExact(rows.reduce((sum, row) => sum + row.quantity, 0))}
                </td>
                <td className="p-3 tabular-nums font-bold text-accent-green">
                  {formatAmountExact(rows.reduce((sum, row) => sum + row.value, 0))} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InventoryStockValueModal({
  open,
  passwordOpen,
  loading,
  error,
  snapshot,
  onClose,
  onSubmitPassword,
  onClosePassword,
}: InventoryStockValueModalProps) {
  const [password, setPassword] = useState("");
  const [detailView, setDetailView] = useState<"none" | "phones" | "accessories">("none");

  useEffect(() => {
    if (!open) {
      setPassword("");
      setDetailView("none");
    }
  }, [open]);

  useEffect(() => {
    if (snapshot) setDetailView("none");
  }, [snapshot]);

  return (
    <>
      <Modal
        open={passwordOpen}
        onClose={() => !loading && onClosePassword()}
        title="تأكيد الدخول — قيمة المخزون"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            أدخل كلمة مرور حسابك (أدمن / سوبر أدمن) لعرض قيمة مخزون الفرع.
          </p>
          <div>
            <label className="block text-xs text-muted mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && password.trim() && !loading) {
                  onSubmitPassword(password);
                }
              }}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClosePassword}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm text-muted border border-border hover:bg-white/5 disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={loading || !password.trim()}
              onClick={() => onSubmitPassword(password)}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40"
            >
              {loading ? "جاري التحقق..." : "عرض القيمة"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={onClose} title="قيمة المخزون — الفرع الحالي" size="lg">
        {loading && !snapshot ? (
          <p className="text-sm text-muted text-center py-10">جاري تحميل القيم...</p>
        ) : snapshot ? (
          <div className="space-y-4 pb-1">
            <p className="text-xs text-muted">
              تكلفة الشراء للمخزون المتاح — موبايلات (سيريالات available) + إكسسوار (كمية × سعر شراء).
              لا يتأثر بفلاتر الجدول.
            </p>

            <SummaryCard
              label="إجمالي المخزون"
              value={snapshot.totalValue}
              quantity={snapshot.phoneQuantity + snapshot.accessoryQuantity}
              emoji="💰"
              accent="border-primary/30 bg-primary/10"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryCard
                label="موبايلات — اضغط للتفاصيل"
                value={snapshot.phoneValue}
                quantity={snapshot.phoneQuantity}
                emoji="📱"
                accent="border-sky-400/25 bg-sky-500/10"
                active={detailView === "phones"}
                onClick={() =>
                  setDetailView((prev) => (prev === "phones" ? "none" : "phones"))
                }
              />
              <SummaryCard
                label="إكسسوار — اضغط للتفاصيل"
                value={snapshot.accessoryValue}
                quantity={snapshot.accessoryQuantity}
                emoji="🎧"
                accent="border-violet-400/25 bg-violet-500/10"
                active={detailView === "accessories"}
                onClick={() =>
                  setDetailView((prev) => (prev === "accessories" ? "none" : "accessories"))
                }
              />
            </div>

            {detailView === "phones" ? (
              <BreakdownTable
                title="تفصيل الموبايلات حسب الشركة"
                rows={snapshot.phonesByBrand}
                emptyMessage="لا توجد موبايلات available في المخزون"
              />
            ) : null}

            {detailView === "accessories" ? (
              <BreakdownTable
                title="تفصيل الإكسسوار حسب الفئة"
                rows={snapshot.accessoriesByCategory}
                emptyMessage="لا توجد إكسسوار في المخزون"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-10">لا توجد بيانات للعرض</p>
        )}
      </Modal>
    </>
  );
}
