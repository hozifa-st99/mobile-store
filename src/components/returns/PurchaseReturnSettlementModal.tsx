"use client";

import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { formatAmountExact, formatCurrency } from "@/lib/utils";

interface PurchaseReturnSettlementModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: { shiftDepositAmount: number; receivableAmount: number }) => void;
  loading?: boolean;
  returnTotal: number;
  creditReduction: number;
  expenseRecoveryCash?: number;
  invoiceNumber: string;
}

export default function PurchaseReturnSettlementModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  returnTotal,
  creditReduction,
  expenseRecoveryCash = 0,
  invoiceNumber,
}: PurchaseReturnSettlementModalProps) {
  const cashSettleable = Math.max(
    0,
    Math.round((returnTotal - creditReduction - expenseRecoveryCash) * 100) / 100
  );

  const [shiftDepositInput, setShiftDepositInput] = useState("");

  useEffect(() => {
    if (open) {
      setShiftDepositInput(cashSettleable > 0 ? String(cashSettleable) : "0");
    }
  }, [open, cashSettleable]);

  const shiftDepositAmount = useMemo(() => {
    const n = parseFloat(shiftDepositInput.replace(/,/g, "."));
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
  }, [shiftDepositInput]);

  const receivableAmount = Math.max(
    0,
    Math.round((cashSettleable - shiftDepositAmount) * 100) / 100
  );

  const isValid =
    cashSettleable <= 0.0001 ||
    Math.abs(shiftDepositAmount + receivableAmount - cashSettleable) <= 0.011;

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="تسوية مرتجع المشتريات"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          فاتورة <span className="text-white font-semibold">{invoiceNumber}</span>
        </p>

        <div className="rounded-xl border border-border/60 bg-background-input/20 p-4 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted">إجمالي المرتجع</span>
            <span className="font-bold tabular-nums">{formatCurrency(returnTotal)} ج.م</span>
          </div>
          {creditReduction > 0.0001 && (
            <div className="flex justify-between gap-3">
              <span className="text-amber-200/90">خصم من الأجل (علينا)</span>
              <span className="font-bold tabular-nums text-amber-300">
                {formatCurrency(creditReduction)} ج.م
              </span>
            </div>
          )}
          {expenseRecoveryCash > 0.0001 && (
            <div className="flex justify-between gap-3">
              <span className="text-emerald-200/90">استرداد مصاريف من المورد (تلقائي → الوردية)</span>
              <span className="font-bold tabular-nums text-emerald-300">
                {formatCurrency(expenseRecoveryCash)} ج.م
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3 pt-2 border-t border-border/40">
            <span className="text-white font-medium">مبلغ الأصناف للتسوية (وردية / لنا)</span>
            <span className="font-bold tabular-nums text-primary-light">
              {formatCurrency(cashSettleable)} ج.م
            </span>
          </div>
        </div>

        {cashSettleable > 0.0001 ? (
          <>
            <div>
              <label className="block text-xs text-muted mb-1.5">
                توريد للوردية (خزنة اليومية)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                max={cashSettleable}
                value={shiftDepositInput}
                onChange={(e) => setShiftDepositInput(e.target.value)}
                className="glass-input"
              />
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-cyan-100/90">لنا عند المورد (مستحق)</span>
                <span className="font-bold tabular-nums text-cyan-200">
                  {formatAmountExact(receivableAmount)} ج.م
                </span>
              </div>
              <p className="text-xs text-muted mt-2">
                يُسجَّل في الأجل والمديونيات ويُحصَّل لاحقاً إلى الوردية.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted bg-white/5 border border-border rounded-xl px-3 py-2">
            كامل قيمة المرتجع سيُخصم من الأجل — لا يوجد مبلغ نقدي للتسوية.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={loading || !isValid}
            onClick={() =>
              onConfirm({
                shiftDepositAmount: cashSettleable > 0.0001 ? shiftDepositAmount : 0,
                receivableAmount: cashSettleable > 0.0001 ? receivableAmount : 0,
              })
            }
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? "جاري الحفظ..." : "تأكيد المرتجع"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="btn-outline"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
