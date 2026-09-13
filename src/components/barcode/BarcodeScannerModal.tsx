"use client";

import { useEffect, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

const SCANNER_ELEMENT_ID = "pos-barcode-scanner";

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledRef = useRef(false);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setErrorMessage(null);
      handledRef.current = false;
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setStatus("starting");
      setErrorMessage(null);
      handledRef.current = false;

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(viewfinderWidth, viewfinderHeight) * 0.88;
              return { width: Math.floor(width), height: Math.floor(width * 0.45) };
            },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (handledRef.current) return;
            const value = decodedText.trim();
            if (!value) return;

            handledRef.current = true;
            void scanner.stop().catch(() => undefined);
            scannerRef.current = null;
            onScan(value);
          },
          () => undefined
        );

        if (!cancelled) setStatus("scanning");
      } catch {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage("تعذر فتح الكاميرا — تأكد من إذن الكاميرا أو استخدم HTTPS");
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => undefined);
      }
    };
  }, [open, onScan]);

  return (
    <Modal open={open} onClose={onClose} title="مسح باركود / IMEI" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          وجّه الكاميرا نحو الباركود أو IMEI — سيتم البحث تلقائياً بعد المسح.
        </p>

        <div className="relative overflow-hidden rounded-xl border border-border bg-black/40">
          <div id={SCANNER_ELEMENT_ID} className="min-h-[240px] w-full [& video]:rounded-xl" />
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
              جاري تشغيل الكاميرا…
            </div>
          )}
        </div>

        {status === "error" && errorMessage && (
          <p className="text-xs text-red-400 text-center">{errorMessage}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-border py-2.5 text-sm text-muted hover:text-white hover:border-white/20 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
}
