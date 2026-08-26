"use client";

import { useEffect, useRef } from "react";

import SaleInvoiceDocument from "@/components/print/SaleInvoiceDocument";
import {
  SAMPLE_SALE_INVOICE,
  type PrintSettings,
  type SaleInvoicePrintContext,
} from "@/lib/print-settings";
import { printInvoiceFromContainer } from "@/lib/print-utils";

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  settings: PrintSettings;
  context: SaleInvoicePrintContext;
}

export default function PrintPreviewModal({
  open,
  onClose,
  settings,
  context,
}: PrintPreviewModalProps) {
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

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="no-print flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">معاينة طباعة الفاتورة</h2>
            <p className="text-sm text-muted">معاينة بالإعدادات الحالية قبل الحفظ أو الطباعة</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printInvoiceFromContainer(previewRef.current)}
              className="btn-primary"
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

        <div ref={previewRef} className="invoice-print-viewport bg-white">
          <SaleInvoiceDocument sale={SAMPLE_SALE_INVOICE} context={context} settings={settings} />
        </div>
      </div>
    </div>
  );
}
