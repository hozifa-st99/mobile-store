"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, ScanLine } from "lucide-react";

import Modal from "@/components/ui/Modal";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

const SCANNER_ELEMENT_ID = "pos-barcode-scanner";

type ActiveScanner = {
  stop: () => Promise<void>;
  scanFileV2: (file: File, showImage?: boolean) => Promise<{ decodedText: string }>;
  getRunningTrackCameraCapabilities: () => {
    torchFeature: () => {
      isSupported: () => boolean;
      apply: (value: boolean) => Promise<void>;
    };
  };
};

async function captureFrameFromVideo(containerId: string): Promise<File | null> {
  const video = document.getElementById(containerId)?.querySelector("video");
  if (!video || !(video instanceof HTMLVideoElement) || video.videoWidth === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92);
  });
  if (!blob) return null;

  return new File([blob], "barcode-capture.jpg", { type: "image/jpeg" });
}

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "capturing" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const handledRef = useRef(false);
  const scannerRef = useRef<ActiveScanner | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const finishScan = useCallback((scanner: ActiveScanner, value: string) => {
    if (handledRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    handledRef.current = true;
    void scanner.stop().catch(() => undefined);
    scannerRef.current = null;
    onScanRef.current(trimmed);
  }, []);

  const handleCapture = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || handledRef.current || status !== "scanning") return;

    setStatus("capturing");
    setHintMessage(null);

    try {
      const file = await captureFrameFromVideo(SCANNER_ELEMENT_ID);
      if (!file) {
        setHintMessage("ثبّت الكاميرا على الباركود ثم اضغط «التقاط» مرة أخرى");
        setStatus("scanning");
        return;
      }

      const result = await scanner.scanFileV2(file, false);
      if (result.decodedText?.trim()) {
        finishScan(scanner, result.decodedText);
        return;
      }

      setHintMessage("لم يُقرأ الباركود — قرّب الكاميرا أو فعّل الفلاش ثم اضغط «التقاط»");
      setStatus("scanning");
    } catch {
      setHintMessage("لم يُقرأ الباركود — ثبّت الصورة واضغط «التقاط» مرة أخرى");
      setStatus("scanning");
    }
  }, [finishScan, status]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !torchSupported) return;

    try {
      const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
      setHintMessage(null);
    } catch {
      setHintMessage("تعذر تشغيل الفلاش على هذا الجهاز");
    }
  }, [torchOn, torchSupported]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setErrorMessage(null);
      setHintMessage(null);
      setTorchSupported(false);
      setTorchOn(false);
      handledRef.current = false;
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setStatus("starting");
      setErrorMessage(null);
      setHintMessage("يمكنك الانتظار للمسح التلقائي أو الضغط على «التقاط»");
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
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        }) as ActiveScanner;
        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: "environment",
          },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.92);
              return { width, height: Math.floor(width * 0.55) };
            },
            aspectRatio: 1,
            disableFlip: false,
            videoConstraints: {
              facingMode: "environment",
              focusMode: "continuous",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          (decodedText) => {
            finishScan(scanner, decodedText);
          },
          () => undefined
        );

        if (cancelled) return;

        try {
          const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
          setTorchSupported(torch.isSupported());
        } catch {
          setTorchSupported(false);
        }

        setStatus("scanning");
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
  }, [open, finishScan]);

  return (
    <Modal open={open} onClose={onClose} title="مسح باركود / IMEI" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          ثبّت الكاميرا على الباركود — يُمسح تلقائياً، أو اضغط «التقاط» للقراءة الفورية.
        </p>

        <div className="relative overflow-hidden rounded-xl border border-border bg-black/40">
          <div id={SCANNER_ELEMENT_ID} className="min-h-[260px] w-full [& video]:rounded-xl" />
          {(status === "starting" || status === "capturing") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
              {status === "starting" ? "جاري تشغيل الكاميرا…" : "جاري قراءة الصورة…"}
            </div>
          )}
        </div>

        {hintMessage && status !== "error" && (
          <p className="text-xs text-amber-300/90 text-center leading-relaxed">{hintMessage}</p>
        )}

        {status === "error" && errorMessage && (
          <p className="text-xs text-red-400 text-center">{errorMessage}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleCapture()}
            disabled={status !== "scanning"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary/25 border border-primary/35 py-2.5 text-sm font-semibold text-primary-light hover:bg-primary/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
            التقاط
          </button>

          {torchSupported && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              disabled={status !== "scanning"}
              className={`inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                torchOn
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                  : "border-border bg-white/5 text-muted hover:text-white"
              }`}
              title="فلاش الكاميرا"
              aria-label="فلاش الكاميرا"
            >
              <Flashlight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

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
