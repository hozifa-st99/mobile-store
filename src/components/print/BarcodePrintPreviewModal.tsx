"use client";

import { useEffect, useRef } from "react";

import BarcodeLabelsDocument from "@/components/print/BarcodeLabelsDocument";
import {
  getBarcodeLabelMeta,
  SAMPLE_BARCODE_LABEL,
  type BarcodePrintSettings,
} from "@/lib/barcode-print-settings";
import { printBarcodeFromContainer } from "@/lib/print-utils";

interface BarcodePrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  settings: BarcodePrintSettings;
}

export default function BarcodePrintPreviewModal({
  open,
  onClose,
  settings,
}: BarcodePrintPreviewModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const labelMeta = getBarcodeLabelMeta(settings.labelSize);

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="no-print flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">معاينة طباعة الباركود</h2>
            <p className="text-sm text-muted">
              المقاس الحالي: <span className="text-white font-semibold">{labelMeta.label}</span>
              {" · "}
              {labelMeta.widthMm}×{labelMeta.heightMm} مم
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printBarcodeFromContainer(previewRef.current)}
              className="btn-primary !w-auto px-4 py-2"
            >
              طباعة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 border border-border text-white"
            >
              إغلاق
            </button>
          </div>
        </div>

        <div ref={previewRef} className="barcode-print-viewport">
          <BarcodeLabelsDocument
            key={settings.labelSize}
            settings={settings}
            labels={[SAMPLE_BARCODE_LABEL]}
            preview
          />
        </div>
      </div>
    </div>
  );
}
