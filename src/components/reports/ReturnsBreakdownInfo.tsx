"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn, formatCurrency } from "@/lib/utils";

interface ReturnsBreakdownInfoProps {
  total: number;
  count: number;
  label?: string;
  mode?: "hover" | "click";
  className?: string;
}

export default function ReturnsBreakdownInfo({
  total,
  count,
  label = "مرتجعات",
  mode = "click",
  className,
}: ReturnsBreakdownInfoProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 220;
    let left = rect.right - width;
    if (left < 12) left = 12;
    setPosition({ top: rect.bottom + 8, left });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (mode !== "click" || !open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      hide();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [mode, open, hide]);

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            className="profit-info-popover profit-info-popover--portal"
            style={position}
            role="tooltip"
          >
            <p className="profit-info-popover__hint">{label} في الفترة المحددة</p>
            <div className="profit-info-popover__row">
              <span>إجمالي {label}</span>
              <strong>{formatCurrency(total)} ج.م</strong>
            </div>
            <div className="profit-info-popover__row">
              <span>عدد الفواتير المرتجعة</span>
              <strong>{count}</strong>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`تفاصيل ${label}`}
        aria-expanded={mode === "click" ? open : undefined}
        onClick={mode === "click" ? () => (open ? hide() : show()) : undefined}
        onMouseEnter={mode === "hover" ? show : undefined}
        onMouseLeave={mode === "hover" ? hide : undefined}
        className={cn("profit-info-trigger", mode === "click" ? "cursor-pointer" : "cursor-help")}
      >
        <Info className="w-3 h-3" strokeWidth={2.75} />
      </button>
      {popover}
    </div>
  );
}
