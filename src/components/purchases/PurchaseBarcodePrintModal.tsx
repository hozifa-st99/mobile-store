"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BarcodeLabelsDocument from "@/components/print/BarcodeLabelsDocument";
import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import {
  buildSavedPurchaseItemRows,
  type SavedPurchaseItem,
} from "@/lib/purchase-detail-display";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import {
  DEFAULT_BARCODE_PRINT_SETTINGS,
  type BarcodeLabelItem,
  type BarcodePrintSettings,
} from "@/lib/barcode-print-settings";
import { formatCurrency } from "@/lib/utils";
import { printBarcodeFromContainer } from "@/lib/print-utils";

interface PurchaseBarcodePrintModalProps {
  open: boolean;
  items: SavedPurchaseItem[];
  invoiceNumber: string;
  onClose: () => void;
}

function defaultPrintQty(item: SavedPurchaseItem): number {
  if (!item.barcode?.trim()) return 0;
  const isPhone = parseImeisSnapshot(item.imeisSnapshot).length > 0;
  return isPhone ? 1 : Math.max(1, item.quantity || 1);
}

export default function PurchaseBarcodePrintModal({
  open,
  items,
  invoiceNumber,
  onClose,
}: PurchaseBarcodePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<BarcodePrintSettings>(DEFAULT_BARCODE_PRINT_SETTINGS);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printLabels, setPrintLabels] = useState<BarcodeLabelItem[]>([]);

  const rows = useMemo(() => buildSavedPurchaseItemRows(items), [items]);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setPrinting(false);
    setPrintLabels([]);

    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.id] = defaultPrintQty(item);
    }
    setQuantities(initial);

    fetch("/api/settings/print-barcode", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [open, items]);

  const setLineQty = (itemId: string, value: number) => {
    const safe = Math.max(0, Math.min(999, Math.round(value) || 0));
    setQuantities((current) => ({ ...current, [itemId]: safe }));
  };

  const buildLabels = (): BarcodeLabelItem[] => {
    const labels: BarcodeLabelItem[] = [];

    for (const item of items) {
      const copies = quantities[item.id] ?? 0;
      const barcode = item.barcode?.trim();
      if (copies <= 0 || !barcode) continue;

      const name = item.description.split(" · ")[0]?.trim() || item.description;
      for (let index = 0; index < copies; index += 1) {
        labels.push({
          barcodeValue: barcode,
          name,
          price: item.retailPrice,
        });
      }
    }

    return labels;
  };

  const handleConfirmPrint = () => {
    const missingBarcodeSelected = items.some(
      (item) => (quantities[item.id] ?? 0) > 0 && !item.barcode?.trim()
    );
    if (missingBarcodeSelected) {
      setError("بعض البنود المختارة بدون باركود مسجّل");
      return;
    }

    const labels = buildLabels();
    if (labels.length === 0) {
      setError("حدد عدد الملصقات لبند واحد على الأقل");
      return;
    }

    setError(null);
    setPrintLabels(labels);
    setPrinting(true);
  };

  useEffect(() => {
    if (!printing || printLabels.length === 0) return;

    const timer = window.setTimeout(() => {
      printBarcodeFromContainer(printRef.current);
      setPrinting(false);
      onClose();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [printing, printLabels, onClose]);

  const totalLabels = useMemo(
    () => Object.values(quantities).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0),
    [quantities]
  );

  return (
    <>
      <Modal
        open={open && !printing}
        onClose={onClose}
        title="طباعة باركود — فاتورة مشتريات"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted inline-flex items-center gap-2">
            <span aria-hidden>{em.invoice}</span>
            {invoiceNumber}
          </p>

          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-border/50 bg-background-input/20">
                  <th className="text-right p-3 font-medium">الصنف</th>
                  <th className="text-right p-3 font-medium">الباركود</th>
                  <th className="text-right p-3 font-medium">سعر البيع</th>
                  <th className="text-right p-3 font-medium w-36">عدد الملصقات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hasBarcode = row.barcode && row.barcode !== "—";
                  const qty = quantities[row.id] ?? 0;

                  return (
                    <tr key={row.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3 align-top">
                        <p className="font-medium text-white">{row.name}</p>
                        <p className="text-xs text-muted mt-0.5">{row.typeLabel}</p>
                        {row.imeis.length > 0 ? (
                          <p className="text-[11px] text-muted-dark mt-0.5 font-mono" dir="ltr">
                            IMEI: {row.imeis.join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3 align-top">
                        {hasBarcode ? (
                          <span className="font-mono text-xs" dir="ltr">
                            {row.barcode}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400">بدون باركود</span>
                        )}
                      </td>
                      <td className="p-3 align-top tabular-nums text-accent-green">
                        {formatCurrency(row.retailPrice)} ج.م
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!hasBarcode}
                            onClick={() => setLineQty(row.id, qty - 1)}
                            className="w-8 h-8 rounded-lg border border-border text-muted hover:text-white disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={999}
                            disabled={!hasBarcode}
                            value={qty}
                            onChange={(event) =>
                              setLineQty(row.id, Number(event.target.value) || 0)
                            }
                            className="glass-input w-16 text-center px-2 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            disabled={!hasBarcode}
                            onClick={() => setLineQty(row.id, qty + 1)}
                            className="w-8 h-8 rounded-lg border border-border text-muted hover:text-white disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted inline-flex items-center gap-1.5">
            <span aria-hidden>{em.quantity}</span>
            إجمالي الملصقات للطباعة: {totalLabels}
          </p>

          {error ? (
            <p className="text-sm text-red-400 inline-flex items-center gap-1.5">
              <span aria-hidden>{em.warning}</span>
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted hover:text-white"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmPrint}
              disabled={totalLabels === 0}
              className="btn-primary !w-auto px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <span aria-hidden>{em.print}</span>
              تأكيد الطباعة
            </button>
          </div>
        </div>
      </Modal>

      {printing && printLabels.length > 0 ? (
        <div className="fixed -left-[9999px] top-0" aria-hidden>
          <div ref={printRef}>
            <BarcodeLabelsDocument settings={settings} labels={printLabels} />
          </div>
        </div>
      ) : null}
    </>
  );
}
