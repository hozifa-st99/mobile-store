"use client";

import { Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn, formatCurrency } from "@/lib/utils";

interface ProfitBreakdownInfoProps {
  actualCash: number;
  purchases: number;
  saleReturns?: number;
  purchaseReturnSubtotal?: number;
  purchaseExpenseRecovered?: number;
  purchaseDebtPayments?: number;
  profit?: number;
  cogs?: number;
  expenses?: number;
  sales?: number;
  mode?: "hover" | "click";
  className?: string;
}

interface PopoverPosition {
  top: number;
  left: number;
}

function ProfitInfoPopover({
  actualCash,
  purchases,
  saleReturns = 0,
  purchaseReturnSubtotal = 0,
  purchaseExpenseRecovered = 0,
  purchaseDebtPayments = 0,
  profit,
  cogs,
  expenses,
  sales,
  style,
  popoverRef,
}: {
  actualCash: number;
  purchases: number;
  saleReturns?: number;
  purchaseReturnSubtotal?: number;
  purchaseExpenseRecovered?: number;
  purchaseDebtPayments?: number;
  profit?: number;
  cogs?: number;
  expenses?: number;
  sales?: number;
  style: PopoverPosition;
  popoverRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={popoverRef}
      className="profit-info-popover profit-info-popover--portal"
      style={style}
      role="tooltip"
    >
      {profit != null && sales != null && cogs != null && expenses != null ? (
        <>
          <p className="profit-info-popover__hint">
            صافي الربح = صافي المبيعات − تكلفة البضاعة المباعة − المصروفات
          </p>
          <div className="profit-info-popover__row">
            <span>صافي المبيعات</span>
            <strong>{formatCurrency(sales)} ج.م</strong>
          </div>
          <div className="profit-info-popover__row">
            <span>تكلفة البضاعة (صافي)</span>
            <strong>{formatCurrency(cogs)} ج.م</strong>
          </div>
          <div className="profit-info-popover__row">
            <span>المصروفات</span>
            <strong>{formatCurrency(expenses)} ج.م</strong>
          </div>
          <div className="profit-info-popover__row">
            <span>صافي الربح</span>
            <strong>{formatCurrency(profit)} ج.م</strong>
          </div>
        </>
      ) : null}
      <p className="profit-info-popover__hint">
        النقدي الفعلي = المبيعات − المصروفات − المشتريات − سداد مديونيات (من الوردية) +
        مرتجعات المشتريات − مرتجعات المبيعات − التوريدات الجزئية للخزنة (مطابق للباقي في تقفيل الوردية)
      </p>
      <div className="profit-info-popover__row">
        <span>النقدي الفعلي</span>
        <strong>{formatCurrency(actualCash)} ج.م</strong>
      </div>
      <div className="profit-info-popover__row">
        <span>صافي المشتريات</span>
        <strong>{formatCurrency(purchases)} ج.م</strong>
      </div>
      {purchaseReturnSubtotal > 0 && (
        <div className="profit-info-popover__row">
          <span>توريد مرتجع مشتريات</span>
          <strong className="text-accent-green">+{formatCurrency(purchaseReturnSubtotal)} ج.م</strong>
        </div>
      )}
      {purchaseExpenseRecovered > 0 && (
        <div className="profit-info-popover__row">
          <span>استرداد مصاريف من المورد</span>
          <strong className="text-accent-green">
            +{formatCurrency(purchaseExpenseRecovered)} ج.م
          </strong>
        </div>
      )}
      {saleReturns > 0 && (
        <div className="profit-info-popover__row">
          <span>مرتجعات المبيعات</span>
          <strong>{formatCurrency(saleReturns)} ج.م</strong>
        </div>
      )}
      <div className="profit-info-popover__row">
        <span>إجمالي سداد مديونيات</span>
        <strong>{formatCurrency(purchaseDebtPayments)} ج.م</strong>
      </div>
    </div>
  );
}

export default function ProfitBreakdownInfo({
  actualCash,
  purchases,
  saleReturns = 0,
  purchaseReturnSubtotal = 0,
  purchaseExpenseRecovered = 0,
  purchaseDebtPayments = 0,
  profit,
  cogs,
  expenses,
  sales,
  mode = "hover",
  className,
}: ProfitBreakdownInfoProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const popoverWidth = 248;
    const gap = 8;
    const estimatedHeight = 280;

    let top = rect.bottom + gap;
    let left = rect.right - popoverWidth;

    if (left < 12) left = 12;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }

    if (top + estimatedHeight > window.innerHeight - 12) {
      top = rect.top - estimatedHeight - gap;
    }

    setPosition({ top, left });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

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
          <ProfitInfoPopover
            actualCash={actualCash}
            purchases={purchases}
            saleReturns={saleReturns}
            purchaseReturnSubtotal={purchaseReturnSubtotal}
            purchaseExpenseRecovered={purchaseExpenseRecovered}
            purchaseDebtPayments={purchaseDebtPayments}
            profit={profit}
            cogs={cogs}
            expenses={expenses}
            sales={sales}
            style={position}
            popoverRef={popoverRef}
          />,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="تفاصيل صافي الربح"
        aria-expanded={mode === "click" ? open : undefined}
        onClick={mode === "click" ? () => (open ? hide() : show()) : undefined}
        onMouseEnter={mode === "hover" ? show : undefined}
        onMouseLeave={mode === "hover" ? hide : undefined}
        onFocus={mode === "hover" ? show : undefined}
        onBlur={mode === "hover" ? hide : undefined}
        className={cn("profit-info-trigger", mode === "click" ? "cursor-pointer" : "cursor-help")}
      >
        <Info className="w-3 h-3" strokeWidth={2.75} />
      </button>
      {popover}
    </div>
  );
}
