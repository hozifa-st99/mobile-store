"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import BarcodeLabelsDocument from "@/components/print/BarcodeLabelsDocument";
import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import {
  DEFAULT_BARCODE_PRINT_SETTINGS,
  type BarcodeLabelItem,
  type BarcodePrintSettings,
} from "@/lib/barcode-print-settings";
import { formatCurrency } from "@/lib/utils";
import { printBarcodeFromContainer } from "@/lib/print-utils";

interface ProductSummary {
  id: string;
  name: string;
  brand: string;
  type: string;
  barcode?: string | null;
  retailPrice: number;
  quantity: number;
}

interface PhoneSerialRow {
  id: string;
  imeis: string[];
  imei: string | null;
  barcode: string | null;
  retailPrice: number;
}

interface ProductBarcodePrintModalProps {
  open: boolean;
  product: ProductSummary | null;
  onClose: () => void;
}

export default function ProductBarcodePrintModal({
  open,
  product,
  onClose,
}: ProductBarcodePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<BarcodePrintSettings>(DEFAULT_BARCODE_PRINT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [phoneSerials, setPhoneSerials] = useState<PhoneSerialRow[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printLabels, setPrintLabels] = useState<BarcodeLabelItem[]>([]);

  const isPhone = product?.type === "phone";

  const deviceOptions = useMemo(
    () =>
      phoneSerials.map((serial) => ({
        serialId: serial.id,
        imeiLabel:
          serial.imeis.length > 0
            ? serial.imeis.join(" · ")
            : serial.imei?.trim() || "—",
        barcode: serial.barcode?.trim() || "",
        retailPrice: serial.retailPrice,
      })),
    [phoneSerials]
  );

  useEffect(() => {
    if (!open || !product) return;

    setError(null);
    setQuantity(1);
    setSelectedSerialIds([]);
    setPhoneSerials([]);
    setPrintLabels([]);
    setPrinting(false);

    fetch("/api/settings/print-barcode", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {
        /* keep defaults */
      });

    if (product.type !== "phone") return;

    setLoading(true);
    apiJson<{ product: { phoneSerials?: PhoneSerialRow[] } }>(`/api/products/${product.id}`)
      .then(({ ok, data }) => {
        if (!ok) {
          setError("تعذر تحميل بيانات الموبايل");
          return;
        }
        const serials = data.product?.phoneSerials || [];
        setPhoneSerials(serials);
        setSelectedSerialIds(serials.map((serial) => serial.id));
      })
      .finally(() => setLoading(false));
  }, [open, product]);

  const toggleSerial = (serialId: string) => {
    setSelectedSerialIds((current) =>
      current.includes(serialId)
        ? current.filter((value) => value !== serialId)
        : [...current, serialId]
    );
  };

  const buildLabels = (): BarcodeLabelItem[] => {
    if (!product) return [];

    if (isPhone) {
      return deviceOptions
        .filter((row) => selectedSerialIds.includes(row.serialId))
        .filter((row) => row.barcode)
        .map((row) => ({
          barcodeValue: row.barcode,
          name: product.name,
          price: row.retailPrice,
        }));
    }

    if (!product.barcode?.trim()) return [];

    const copies = Math.max(1, Math.min(product.quantity || 1, Math.round(quantity) || 1));
    return Array.from({ length: copies }, () => ({
      barcodeValue: product.barcode!.trim(),
      name: product.name,
      price: product.retailPrice,
    }));
  };

  const handleConfirmPrint = () => {
    if (!product) return;

    if (isPhone) {
      if (selectedSerialIds.length === 0) {
        setError("اختر جهازاً واحداً على الأقل للطباعة");
        return;
      }

      const missingBarcode = deviceOptions.filter(
        (row) => selectedSerialIds.includes(row.serialId) && !row.barcode
      );
      if (missingBarcode.length > 0) {
        setError("بعض الأجهزة المختارة بدون باركود مسجّل — سجّل باركود الجهاز أولاً");
        return;
      }
    } else if (!product.barcode?.trim()) {
      setError("لا يوجد باركود مسجّل لهذا المنتج");
      return;
    } else if (quantity < 1) {
      setError("أدخل عدداً صحيحاً للطباعة");
      return;
    }

    const labels = buildLabels();
    if (labels.length === 0) {
      setError("لا توجد ملصقات للطباعة");
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

  return (
    <>
      <Modal
        open={open && !printing}
        onClose={onClose}
        title="طباعة باركود"
        size={isPhone ? "md" : "sm"}
      >
        {product ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-background-input/20 p-4 space-y-1">
              <p className="text-sm font-bold text-white">{product.name}</p>
              <p className="text-xs text-muted inline-flex items-center gap-1.5">
                <span aria-hidden>{em.product}</span>
                {product.brand}
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-muted text-center py-4">جاري تحميل الأجهزة...</p>
            ) : isPhone ? (
              <div className="space-y-3">
                <p className="text-sm text-muted inline-flex items-center gap-2">
                  <span aria-hidden>{em.imei}</span>
                  اختر الأجهزة للطباعة (باركود الجهاز — مش رقم IMEI)
                </p>
                {deviceOptions.length === 0 ? (
                  <p className="text-sm text-red-400">لا توجد أجهزة متاحة لهذا المنتج</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-border/40 p-2">
                    {deviceOptions.map((row) => (
                      <label
                        key={row.serialId}
                        className="flex items-center justify-between gap-3 rounded-lg bg-background-input/30 px-3 py-2 cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2 text-sm text-white min-w-0">
                          <input
                            type="checkbox"
                            className="rounded accent-primary shrink-0"
                            checked={selectedSerialIds.includes(row.serialId)}
                            onChange={() => toggleSerial(row.serialId)}
                          />
                          <span className="min-w-0">
                            <span className="block font-mono text-xs" dir="ltr">
                              {row.imeiLabel}
                            </span>
                            {row.barcode ? (
                              <span className="block text-[11px] text-muted mt-0.5" dir="ltr">
                                باركود: {row.barcode}
                              </span>
                            ) : (
                              <span className="block text-[11px] text-red-400 mt-0.5">بدون باركود</span>
                            )}
                          </span>
                        </span>
                        <span className="text-xs text-accent-green shrink-0">
                          {formatCurrency(row.retailPrice)} ج.م
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted mb-2 inline-flex items-center gap-2">
                  <span aria-hidden>{em.quantity}</span>
                  عدد الملصقات
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, product.quantity || 1)}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                  className="glass-input w-full max-w-xs"
                />
                <p className="text-xs text-muted mt-1">
                  المتاح في المخزون: {product.quantity}
                  {product.barcode ? ` · الباركود: ${product.barcode}` : ""}
                </p>
              </div>
            )}

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
                disabled={loading || (isPhone && deviceOptions.length === 0)}
                className="btn-primary !w-auto px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                <span aria-hidden>{em.print}</span>
                تأكيد الطباعة
              </button>
            </div>
          </div>
        ) : null}
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
