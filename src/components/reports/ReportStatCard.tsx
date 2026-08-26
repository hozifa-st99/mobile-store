"use client";

import type { KeyboardEvent } from "react";
import type { ReactNode } from "react";

import { kpiThemes, type KpiVariant } from "@/components/ui/kpi-themes";

export interface ReportStatItem {
  label: string;
  value: string;
  emoji: string;
  onClick?: () => void;
}

interface ReportStatCardProps {
  variant: KpiVariant;
  title: string;
  value: string | number;
  suffix?: string;
  watermark?: string;
  stats?: ReportStatItem[];
  progress?: number;
  titleInfo?: ReactNode;
  titleAction?: ReactNode;
}

export default function ReportStatCard({
  variant,
  title,
  value,
  suffix,
  watermark,
  stats = [],
  progress,
  titleInfo,
  titleAction,
}: ReportStatCardProps) {
  const theme = kpiThemes[variant];

  return (
    <div
      className="report-stat-card group"
      style={
        {
          "--card-bg": theme.bg,
          "--card-shadow": theme.shadow,
          "--card-shine": theme.shine,
          "--card-title-color": theme.titleColor,
          "--card-detail-color": theme.detailColor,
        } as React.CSSProperties
      }
    >
      <span className="report-stat-card__gloss" aria-hidden />
      {watermark && (
        <span className="report-stat-card__watermark" aria-hidden>
          {watermark}
        </span>
      )}

      <div className="relative z-[1] flex flex-col h-full min-h-[210px]">
        <div className="flex items-center gap-[3mm]">
          <p className="report-stat-card__title">{title}</p>
          {titleAction}
          {titleInfo ? <span className="ms-auto shrink-0">{titleInfo}</span> : null}
        </div>

        <div className="mt-2 mb-4">
          <p className="report-stat-card__value">{value}</p>
          {suffix && <span className="report-stat-card__badge">{suffix}</span>}
        </div>

        {stats.length > 0 && (
          <div className="report-stat-card__stats mt-auto space-y-2.5">
            {stats.map((item) => (
              <div
                key={item.label}
                className={`report-stat-card__stat-row${item.onClick ? " cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                {...(item.onClick
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      onClick: item.onClick,
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          item.onClick?.();
                        }
                      },
                    }
                  : {})}
              >
                <span className="report-stat-card__stat-label">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="report-stat-card__stat-value">{item.value}</span>
                  <span className="report-stat-card__stat-icon">{item.emoji}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {progress !== undefined && (
          <div className="report-stat-card__progress mt-4">
            <div className="report-stat-card__progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
