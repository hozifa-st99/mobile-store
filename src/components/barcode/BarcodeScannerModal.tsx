"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, ScanLine } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import Modal from "@/components/ui/Modal";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

type TargetPoint = { x: number; y: number };

const WARMUP_MS = 1500;
const ROI_WIDTH_RATIO = 0.68;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

async function decodeCanvas(
  reader: BrowserMultiFormatReader,
  canvas: HTMLCanvasElement
): Promise<string | null> {
  const image = new Image();
  image.src = canvas.toDataURL("image/jpeg", 0.95);
  await image.decode();
  try {
    const result = await reader.decodeFromImageElement(image);
    return result.getText()?.trim() || null;
  } catch {
    return null;
  }
}

async function decodeFromVideoRegion(
  reader: BrowserMultiFormatReader,
  video: HTMLVideoElement,
  target: TargetPoint
): Promise<string[]> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return [];

  const found = new Set<string>();
  const scales = [1, 0.82, 1.18];

  for (const scale of scales) {
    const roiW = Math.floor(vw * ROI_WIDTH_RATIO * scale);
    const roiH = Math.floor(roiW * 0.42);
    const centerX = Math.floor(clamp01(target.x) * vw);
    const centerY = Math.floor(clamp01(target.y) * vh);

    let sx = Math.max(0, centerX - Math.floor(roiW / 2));
    let sy = Math.max(0, centerY - Math.floor(roiH / 2));
    sx = Math.min(sx, Math.max(0, vw - roiW));
    sy = Math.min(sy, Math.max(0, vh - roiH));

    const canvas = document.createElement("canvas");
    canvas.width = roiW;
    canvas.height = roiH;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.drawImage(video, sx, sy, roiW, roiH, 0, 0, roiW, roiH);
    const text = await decodeCanvas(reader, canvas);
    if (text) found.add(text);
  }

  return [...found];
}

async function focusAtPoint(track: MediaStreamTrack, point: TargetPoint): Promise<void> {
  const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
    pointsOfInterest?: Array<{ x: number; y: number }>;
  };

  const advanced: MediaTrackConstraintSet[] = [];

  if (caps?.pointsOfInterest) {
    advanced.push({
      pointsOfInterest: [{ x: clamp01(point.x), y: clamp01(point.y) }],
    } as MediaTrackConstraintSet);
  }

  if (caps?.focusMode?.includes("single-shot")) {
    advanced.push({ focusMode: "single-shot" });
  } else if (caps?.focusMode?.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }

  if (advanced.length === 0) return;

  try {
    await track.applyConstraints({ advanced });
  } catch {
    try {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    } catch {
      /* بعض الأجهزة لا تدعم ضبط الفوكس البرمجي */
    }
  }
}

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "capturing" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [warmupLeft, setWarmupLeft] = useState(0);
  const [target, setTarget] = useState<TargetPoint>({ x: 0.5, y: 0.5 });
  const [pickOptions, setPickOptions] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;

    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] as MediaTrackConstraintSet[] });
      setTorchOn(next);
      setHintMessage(null);
    } catch {
      setHintMessage("تعذر تشغيل الفلاش على هذا الجهاز");
    }
  }, [torchOn, torchSupported]);

  const handleTargetTap = useCallback(
    async (clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const x = clamp01((clientX - rect.left) / rect.width);
      const y = clamp01((clientY - rect.top) / rect.height);
      const next = { x, y };
      setTarget(next);
      setPickOptions([]);
      setHintMessage("تم تحديد الباركود — اضغط «التقاط»");

      if (track) {
        await focusAtPoint(track, next);
      }
    },
    []
  );

  const finishWithValue = useCallback(
    (value: string) => {
      stopCamera();
      onScanRef.current(value);
    },
    [stopCamera]
  );

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const reader = readerRef.current;
    if (!video || !reader || status !== "ready") return;

    setStatus("capturing");
    setHintMessage(null);
    setPickOptions([]);

    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        await focusAtPoint(track, target);
        await new Promise((resolve) => window.setTimeout(resolve, 280));
      }

      const results = await decodeFromVideoRegion(reader, video, target);
      if (results.length === 1) {
        finishWithValue(results[0]!);
        return;
      }

      if (results.length > 1) {
        setPickOptions(results);
        setHintMessage("وُجد أكثر من باركود — اختر الصحيح:");
        setStatus("ready");
        return;
      }

      setHintMessage("لم يُقرأ الباركود — اضغط على الباركود في الشاشة ثم «التقاط»");
      setStatus("ready");
    } catch {
      setHintMessage("لم يُقرأ الباركود — قرّب الكاميرا أو فعّل الفلاش");
      setStatus("ready");
    }
  }, [finishWithValue, status, target]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStatus("idle");
      setErrorMessage(null);
      setHintMessage(null);
      setTorchSupported(false);
      setTorchOn(false);
      setWarmupLeft(0);
      setTarget({ x: 0.5, y: 0.5 });
      setPickOptions([]);
      return;
    }

    let cancelled = false;
    let warmupTimer: ReturnType<typeof setInterval> | null = null;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    readerRef.current = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 500,
    });

    const start = async () => {
      setStatus("starting");
      setErrorMessage(null);
      setHintMessage("جاري تشغيل الكاميرا وضبط الفوكس…");
      setPickOptions([]);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: { ideal: "continuous" },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("NO_VIDEO");

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps?.torch));

        await focusAtPoint(track, { x: 0.5, y: 0.5 });

        let remaining = Math.ceil(WARMUP_MS / 1000);
        setWarmupLeft(remaining);
        warmupTimer = setInterval(() => {
          remaining -= 1;
          setWarmupLeft(Math.max(0, remaining));
          if (remaining <= 0 && warmupTimer) {
            clearInterval(warmupTimer);
            warmupTimer = null;
          }
        }, 1000);

        window.setTimeout(() => {
          if (cancelled) return;
          setStatus("ready");
          setHintMessage("اضغط على الباركود في الشاشة ثم «التقاط»");
        }, WARMUP_MS);
      } catch {
        if (cancelled) return;
        stopCamera();
        setStatus("error");
        setErrorMessage("تعذر فتح الكاميرا — تأكد من إذن الكاميرا أو استخدم HTTPS");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (warmupTimer) clearInterval(warmupTimer);
      stopCamera();
      readerRef.current = null;
    };
  }, [open, stopCamera]);

  const targetStyle = {
    left: `${target.x * 100}%`,
    top: `${target.y * 100}%`,
  };

  return (
    <Modal open={open} onClose={onClose} title="مسح باركود / IMEI" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          اضغط على الباركود في الشاشة لتحديده وضبط الفوكس، ثم اضغط «التقاط».
        </p>

        <div
          ref={viewportRef}
          className="relative overflow-hidden rounded-xl border border-border bg-black touch-none select-none"
          onPointerDown={(event) => {
            if (status !== "ready" && status !== "capturing") return;
            void handleTargetTap(event.clientX, event.clientY);
          }}
        >
          <video
            ref={videoRef}
            className="block w-full min-h-[280px] object-cover"
            muted
            playsInline
            autoPlay
          />

          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-[68%] aspect-[2.4/1] rounded-lg border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={targetStyle}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-cyan-200 whitespace-nowrap">
                منطقة القراءة
              </span>
            </div>
          </div>

          {(status === "starting" || status === "capturing") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm text-white">
              {status === "starting"
                ? warmupLeft > 0
                  ? `جاري ضبط الكاميرا… ${warmupLeft}`
                  : "جاري ضبط الكاميرا…"
                : "جاري قراءة الباركود…"}
            </div>
          )}
        </div>

        {hintMessage && status !== "error" && (
          <p className="text-xs text-amber-300/90 text-center leading-relaxed">{hintMessage}</p>
        )}

        {pickOptions.length > 0 && (
          <div className="space-y-2">
            {pickOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => finishWithValue(value)}
                className="w-full rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm text-white hover:bg-primary/15 hover:border-primary/35 transition-colors tabular-nums"
              >
                {value}
              </button>
            ))}
          </div>
        )}

        {status === "error" && errorMessage && (
          <p className="text-xs text-red-400 text-center">{errorMessage}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleCapture()}
            disabled={status !== "ready"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary/25 border border-primary/35 py-2.5 text-sm font-semibold text-primary-light hover:bg-primary/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
            التقاط
          </button>

          {torchSupported && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              disabled={status !== "ready" && status !== "capturing"}
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
