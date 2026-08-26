"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useToastStore, type ToastItem, type ToastType } from "@/store/toast-store";
import { cn } from "@/lib/utils";

const styles: Record<
  ToastType,
  { emoji: string; bar: string; bg: string; border: string; text: string }
> = {
  error: {
    emoji: "⚠️",
    bar: "bg-red-500",
    bg: "bg-[#1a1224]/95",
    border: "border-red-500/35",
    text: "text-red-100",
  },
  success: {
    emoji: "✅",
    bar: "bg-emerald-500",
    bg: "bg-[#101a16]/95",
    border: "border-emerald-500/35",
    text: "text-emerald-100",
  },
  warning: {
    emoji: "⚡",
    bar: "bg-amber-500",
    bg: "bg-[#1a1710]/95",
    border: "border-amber-500/35",
    text: "text-amber-100",
  },
  info: {
    emoji: "ℹ️",
    bar: "bg-blue-500",
    bg: "bg-[#101520]/95",
    border: "border-blue-500/35",
    text: "text-blue-100",
  },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = styles[item.type];

  return (
    <div
      role="alert"
      className={cn(
        "toast-item pointer-events-auto w-full max-w-md rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden",
        tone.bg,
        tone.border
      )}
    >
      <div className={cn("h-1 w-full", tone.bar)} />
      <div className="flex items-start gap-3 p-4">
        <span className="text-lg leading-none mt-0.5" aria-hidden>
          {tone.emoji}
        </span>
        <p className={cn("flex-1 text-sm font-semibold leading-relaxed", tone.text)}>
          {item.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-8 h-8 rounded-lg bg-white/5 text-muted hover:text-white hover:bg-white/10 transition-colors"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[10050] pointer-events-none flex flex-col items-center gap-3 px-4 pb-5 sm:pb-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>,
    document.body
  );
}
