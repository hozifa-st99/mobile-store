"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleHint?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({ open, onClose, title, titleHint, children, size = "md" }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div
        className={cn(
          "relative w-full luxury-panel shadow-glow animate-slide-up flex flex-col max-h-[min(92dvh,920px)]",
          size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : size === "xl" ? "max-w-5xl" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
          <h3 className="text-lg font-extrabold text-white inline-flex items-baseline gap-2 flex-wrap pe-3">
            <span>{title}</span>
            {titleHint ? (
              <span className="text-xs font-normal text-muted">{titleHint}</span>
            ) : null}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-white"
          >
            <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="X">❌</span>
          </button>
        </div>
        <div className="luxury-section-divider mx-6 flex-shrink-0" />
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}
