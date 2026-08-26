"use client";

import { useEffect, useState } from "react";

import type { ConfirmedPurchaseLine } from "@/components/purchases/purchase-line-types";
import type {
  ExpenseDistribution,
  PurchaseInvoiceExpense,
} from "@/lib/purchase-expense-alloc";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";

const DISTRIBUTION_LABELS: Record<ExpenseDistribution, string> = {
  value: "حسب قيمة البنود",
  quantity: "حسب الكمية",
  manual: "يدوي",
};

interface PurchaseInvoiceExpensesProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  expenses: PurchaseInvoiceExpense[];
  lines: ConfirmedPurchaseLine[];
  onAdd: (expense: PurchaseInvoiceExpense) => void;
  onUpdate: (expense: PurchaseInvoiceExpense) => void;
  onRemove: (id: string) => void;
}

function buildManualDefaults(lines: ConfirmedPurchaseLine[]): Record<string, number> {
  return Object.fromEntries(lines.map((l) => [l.id, 0]));
}

export default function PurchaseInvoiceExpenses({
  enabled,
  onEnabledChange,
  expenses,
  lines,
  onAdd,
  onUpdate,
  onRemove,
}: PurchaseInvoiceExpensesProps) {
  const [nameAr, setNameAr] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [distribution, setDistribution] = useState<ExpenseDistribution>("value");
  const [manual, setManual] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setManual((prev) => {
      const next: Record<string, number> = {};
      for (const line of lines) {
        next[line.id] = prev[line.id] ?? 0;
      }
      return next;
    });
  }, [lines]);

  const resetDraft = () => {
    setNameAr("");
    setAmount("");
    setDistribution("value");
    setManual(buildManualDefaults(lines));
    setEditingId(null);
  };

  const loadExpenseForEdit = (exp: PurchaseInvoiceExpense) => {
    setEditingId(exp.id);
    setNameAr(exp.nameAr);
    setAmount(exp.amount);
    setDistribution(exp.distribution);
    if (exp.distribution === "manual" && exp.manualAllocations) {
      setManual(
        Object.fromEntries(
          lines.map((l) => [l.id, exp.manualAllocations?.[l.id] ?? 0])
        )
      );
    } else {
      setManual(buildManualDefaults(lines));
    }
  };

  const buildExpensePayload = (id: string, amt: number): PurchaseInvoiceExpense => ({
    id,
    nameAr: nameAr.trim(),
    amount: amt,
    distribution,
    ...(distribution === "manual"
      ? {
          manualAllocations: Object.fromEntries(
            lines.map((l) => [l.id, manual[l.id] ?? 0])
          ),
        }
      : {}),
  });

  const validateDraft = (amt: number): boolean => {
    if (!nameAr.trim()) {
      toast.error("أدخل اسم المصروف");
      return false;
    }
    if (!amt || amt <= 0) {
      toast.error("أدخل مبلغ المصروف");
      return false;
    }
    if (lines.length === 0) {
      toast.error("أضف بنوداً للفاتورة أولاً");
      return false;
    }
    if (distribution === "manual") {
      const sum = lines.reduce((s, l) => s + (manual[l.id] ?? 0), 0);
      if (Math.abs(sum - amt) > 0.01) {
        toast.error(
          `مجموع التوزيع (${formatCurrency(sum)}) يجب أن يساوي ${formatCurrency(amt)}`
        );
        return false;
      }
    }
    return true;
  };

  const handleApply = () => {
    const amt = typeof amount === "number" ? amount : Number(amount);
    if (!validateDraft(amt)) return;

    if (editingId) {
      onUpdate(buildExpensePayload(editingId, amt));
      resetDraft();
      toast.success("تم تحديث المصروف على الفاتورة");
      return;
    }

    onAdd(buildExpensePayload(`exp-${Date.now()}`, amt));
    resetDraft();
    toast.success("تم توزيع المصروف على الفاتورة");
  };

  return (
    <div className="border-t border-border pt-3 mt-1 space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="rounded border-border"
        />
        مصاريف الفاتورة (شحن، جمارك، ...)
      </label>

      {enabled && (
        <div className="rounded-xl border border-accent-orange/25 bg-accent-orange/5 p-4 space-y-4">
          {editingId && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-sm">
              <span className="text-accent-orange font-medium">تعديل مصروف مُطبّق</span>
              <button
                type="button"
                onClick={resetDraft}
                className="text-xs text-muted hover:text-white"
              >
                إلغاء التعديل
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">اسم المصروف</label>
              <input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: شحن"
                className="glass-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">المبلغ</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="glass-input text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted mb-2">طريقة التوزيع على البنود</p>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exp-dist"
                  checked={distribution === "value"}
                  onChange={() => setDistribution("value")}
                />
                حسب قيمة البنود (افتراضي)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exp-dist"
                  checked={distribution === "quantity"}
                  onChange={() => setDistribution("quantity")}
                />
                حسب الكمية
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exp-dist"
                  checked={distribution === "manual"}
                  onChange={() => setDistribution("manual")}
                />
                يدوي
              </label>
            </div>
          </div>

          {distribution === "manual" && lines.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3 bg-black/10">
              <p className="text-xs text-muted">مبلغ كل بند (المجموع = مبلغ المصروف)</p>
              {lines.map((line, idx) => (
                <div key={line.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted w-8">#{idx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={manual[line.id] ?? ""}
                    onChange={(e) =>
                      setManual({ ...manual, [line.id]: Number(e.target.value) || 0 })
                    }
                    className="glass-input text-sm flex-1 py-1"
                  />
                  <span className="text-xs text-muted">ج.م</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent-orange/20 border border-accent-orange/40 text-accent-orange hover:bg-accent-orange/30"
            >
              {editingId ? "حفظ التعديل" : "تنفيذ على الفاتورة"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetDraft}
                className="px-5 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5"
              >
                إلغاء
              </button>
            )}
          </div>

          {expenses.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-xs font-semibold text-white">مصاريف مُطبّقة</p>
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 ${
                    editingId === exp.id
                      ? "bg-accent-orange/15 border border-accent-orange/40"
                      : "bg-black/15"
                  }`}
                >
                  <div className="min-w-0">
                    <span>
                      {exp.nameAr}{" "}
                      <span className="text-accent-orange font-bold tabular-nums">
                        {formatCurrency(exp.amount)} ج.م
                      </span>
                    </span>
                    <p className="text-xs text-muted mt-0.5">
                      {DISTRIBUTION_LABELS[exp.distribution]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadExpenseForEdit(exp)}
                      className="text-accent-orange text-xs hover:underline"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingId === exp.id) resetDraft();
                        onRemove(exp.id);
                      }}
                      className="text-red-400 text-xs hover:underline"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
