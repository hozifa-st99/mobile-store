"use client";

import {
  applySuggestedSecondaryImei,
  canShowDualSimSuggestion,
  type ImeiCyclePreview,
} from "@/lib/imei-cycle-preview-types";

interface DualSimImeiSuggestionProps {
  cyclePreview: ImeiCyclePreview | null;
  imeis: string[];
  onApply: (imeis: string[]) => void;
}

export default function DualSimImeiSuggestion({
  cyclePreview,
  imeis,
  onApply,
}: DualSimImeiSuggestionProps) {
  if (!canShowDualSimSuggestion(cyclePreview, imeis)) return null;

  const suggested = cyclePreview.suggestedSecondaryImei;

  return (
    <div className="text-[11px] mt-2 rounded-xl border px-3 py-2 border-accent-orange/30 bg-accent-orange/5 text-accent-orange space-y-2">
      <p>
        آخر دورة سجّلت IMEI2: <span className="font-mono text-white/90">{suggested}</span>
      </p>
      <p className="text-muted">اختياري — يمكن الحفظ بـ IMEI1 فقط دون تعبئة IMEI2</p>
      <button
        type="button"
        onClick={() => onApply(applySuggestedSecondaryImei(imeis, suggested))}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent-orange/40 hover:bg-accent-orange/15 text-accent-orange"
      >
        استخدام IMEI2 السابق
      </button>
    </div>
  );
}
