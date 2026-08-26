"use client";

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatAmountExact } from "@/lib/utils";
import { runPendingOperation } from "@/store/pending-operation-store";

interface DepositAvailability {
  grossNet: number;
  vaultDeposited: number;
  remainingToDeposit: number;
}

interface OpenShiftDepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OpenShiftDepositModal({
  open,
  onClose,
  onSuccess,
}: OpenShiftDepositModalProps) {
  const [loading, setLoading] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [availability, setAvailability] = useState<DepositAvailability>({
    grossNet: 0,
    vaultDeposited: 0,
    remainingToDeposit: 0,
  });

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiJson<{
      openShift?: {
        summary?: {
          grossNet?: number;
          vaultDeposited?: number;
          remainingToDeposit?: number;
          netInPeriod?: number;
        };
      };
    }>("/api/treasury");
    setLoading(false);

    if (!ok || !data?.openShift?.summary) return;

    const summary = data.openShift.summary;
    setAvailability({
      grossNet: summary.grossNet ?? summary.netInPeriod ?? 0,
      vaultDeposited: summary.vaultDeposited ?? 0,
      remainingToDeposit: summary.remainingToDeposit ?? summary.netInPeriod ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setDepositAmount("");
    setDepositNotes("");
    void loadAvailability();
  }, [open, loadAvailability]);

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }

    setDepositing(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>("/api/treasury/deposit-to-vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            notes: depositNotes.trim() || undefined,
          }),
        })
      );

      if (ok) {
        toast.success(data.message || "تم توريد النقدية للخزنة");
        onSuccess?.();
        onClose();
        return;
      }

      toast.error(data.message || "تعذر توريد النقدية");
    } finally {
      setDepositing(false);
    }
  };

  const { grossNet, vaultDeposited, remainingToDeposit } = availability;
  const canDeposit = remainingToDeposit > 0 && !loading;

  return (
    <Modal
      open={open}
      onClose={() => !depositing && onClose()}
      title="توريد نقدية من الوردية المفتوحة"
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-background-input/40 p-4 space-y-2 text-sm">
          {loading ? (
            <p className="text-center text-muted py-2">جاري التحميل...</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">صافي حركات الوردية</span>
                <strong className="text-white tabular-nums">{formatAmountExact(grossNet)} ج.م</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">مُورد للخزنة مسبقاً</span>
                <strong className="text-violet-300 tabular-nums">
                  {formatAmountExact(vaultDeposited)} ج.م
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-2">
                <span className="text-white font-semibold">المتاح للتوريد الآن</span>
                <strong className="text-accent-green tabular-nums">
                  {formatAmountExact(remainingToDeposit)} ج.م
                </strong>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">المبلغ المراد توريده</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.00"
            className="glass-input"
            disabled={loading || depositing}
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
          <input
            type="text"
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            placeholder="سبب التوريد أو ملاحظة..."
            className="glass-input"
            disabled={loading || depositing}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setDepositAmount(String(remainingToDeposit))}
            disabled={!canDeposit || depositing}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-border text-muted hover:bg-white/5 disabled:opacity-40"
          >
            توريد كامل المتبقي
          </button>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={depositing}
            className="px-4 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5 disabled:opacity-40"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void handleDeposit()}
            disabled={depositing || !canDeposit}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-accent-green/25 border border-accent-green/40 text-accent-green hover:bg-accent-green/35 disabled:opacity-40"
          >
            {depositing ? "جاري التوريد..." : "تأكيد التوريد"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
