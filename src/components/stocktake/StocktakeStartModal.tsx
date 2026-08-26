"use client";

import Modal from "@/components/ui/Modal";

interface StocktakeStartModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFull: () => void;
  onSelectPartial: () => void;
}

export default function StocktakeStartModal({
  open,
  onClose,
  onSelectFull,
  onSelectPartial,
}: StocktakeStartModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="بدء تسوية / جرد" size="sm">
      <div className="space-y-5">
        <p className="text-sm text-muted leading-relaxed">
          اختر نوع الجرد الذي تريد تنفيذه. سيتم إنشاء مستند جرد برقم تلقائي بعد الاعتماد.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={onSelectFull}
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-4 text-right transition-all hover:bg-primary/20 hover:border-primary/50"
          >
            <p className="text-sm font-bold text-white">جرد كلي</p>
            <p className="text-xs text-muted mt-1">عرض كل أصناف المخزون في جدول واحد للمطابقة</p>
          </button>

          <button
            type="button"
            onClick={onSelectPartial}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-right transition-all hover:bg-amber-500/20 hover:border-amber-500/50"
          >
            <p className="text-sm font-bold text-amber-100">جرد جزئي</p>
            <p className="text-xs text-muted mt-1">ابحث عن الأصناف وأضفها للجدول واحداً تلو الآخر</p>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
