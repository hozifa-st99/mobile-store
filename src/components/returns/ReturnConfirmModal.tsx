"use client";

import Modal from "@/components/ui/Modal";

export interface ReturnConfirmRow {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: "primary" | "emerald" | "amber";
}

interface ReturnConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  rows: ReturnConfirmRow[];
  confirmLabel?: string;
  loading?: boolean;
}

const accentClass: Record<NonNullable<ReturnConfirmRow["accent"]>, string> = {
  primary: "text-primary-light",
  emerald: "text-emerald-300",
  amber: "text-amber-200",
};

export default function ReturnConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  rows,
  confirmLabel = "تأكيد التنفيذ",
  loading = false,
}: ReturnConfirmModalProps) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-muted">راجع تفاصيل المرتجع قبل التنفيذ:</p>

        <div className="rounded-xl border border-border/60 bg-background-input/30 divide-y divide-border/40">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                row.highlight ? "bg-white/[0.03]" : ""
              }`}
            >
              <span className="text-xs text-muted shrink-0">{row.label}</span>
              <span
                className={`text-sm font-semibold text-right ${
                  row.accent ? accentClass[row.accent] : "text-white"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted">هل تريد تنفيذ العملية؟</p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 min-w-[140px] px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-40"
          >
            {loading ? "جاري التنفيذ..." : confirmLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-muted border border-border hover:bg-white/5 disabled:opacity-40"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
