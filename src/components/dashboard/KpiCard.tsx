"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { kpiThemes, type KpiVariant } from "@/components/ui/kpi-themes";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type { KpiVariant };

export interface KpiSplitRow {
  label: string;
  count: number;
  total?: number;
}

interface KpiCardProps {
  title: string;
  value?: string | number;
  suffix?: string;
  subtitle?: string;
  icon?: LucideIcon;
  emoji?: string;
  trend?: string;
  variant?: KpiVariant;
  delay?: number;
  className?: string;
  titleInfo?: ReactNode;
  splitRows?: KpiSplitRow[];
  splitLayout?: "columns" | "stack";
  tall?: boolean;
  compact?: boolean;
}

export default function KpiCard({
  title,
  value,
  suffix,
  subtitle,
  icon: Icon,
  emoji,
  trend,
  variant = "sales",
  delay = 0,
  className,
  titleInfo,
  splitRows,
  splitLayout = "stack",
  tall = false,
  compact = false,
}: KpiCardProps) {
  const theme = kpiThemes[variant];
  const safeNumber = (n: number | undefined) => (Number.isFinite(n) ? (n as number) : 0);
  const displayValue =
    value === undefined
      ? ""
      : typeof value === "number"
        ? suffix === "ج.م"
          ? formatCurrency(safeNumber(value))
          : formatNumber(safeNumber(value))
        : value;

  return (
    <div
      className={`kpi-premium group h-full${tall ? " kpi-premium--tall" : ""}${compact ? " kpi-premium--compact" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          "--kpi-bg": theme.bg,
          "--kpi-shadow": theme.shadow,
          "--kpi-shine": theme.shine,
          animationDelay: `${delay}ms`,
        } as React.CSSProperties
      }
    >
      <span className="kpi-premium__gloss" aria-hidden />

      <div className={`relative z-[1] flex flex-col${compact ? " gap-2" : " gap-3"}${tall ? " flex-1 min-h-0" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-[3mm] min-w-0">
            <p className="kpi-premium__title">{title}</p>
            {titleInfo}
          </div>
          <div className="kpi-premium__icon">
            {emoji ? (
              <span className="text-2xl">{emoji}</span>
            ) : Icon ? (
              <Icon className="w-5 h-5" />
            ) : null}
          </div>
        </div>

        <div className={tall ? "flex flex-1 flex-col justify-center min-h-0" : undefined}>
          {splitRows && splitRows.length > 0 ? (
            <>
              <div className={splitLayout === "columns" ? "grid grid-cols-2 gap-3" : "space-y-3.5"}>
                {splitRows.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <p className="kpi-premium__subtitle text-[11px] mb-1 leading-snug">{row.label}</p>
                    <div className="flex items-end justify-between gap-2">
                      <span
                        className={`font-bold tabular-nums ${
                          splitLayout === "stack" ? "text-xl" : "text-lg"
                        }`}
                      >
                        {formatNumber(safeNumber(row.count))}
                      </span>
                      {row.total !== undefined && (
                        <span className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">
                          {formatCurrency(safeNumber(row.total))} ج.م
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {subtitle && (
                <div className="mt-2">
                  <span className="kpi-premium__subtitle">{subtitle}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="kpi-premium__value">{displayValue}</p>
              {(suffix || subtitle || trend) && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {suffix && <span className="kpi-premium__badge">{suffix}</span>}
                  {trend && <span className="kpi-premium__subtitle">{trend}</span>}
                  {subtitle && <span className="kpi-premium__subtitle">{subtitle}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
