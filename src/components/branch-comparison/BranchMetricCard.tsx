"use client";

import type { ReactNode } from "react";
import { em } from "@/components/ui/TableEmoji";

const CARD_THEMES = [
  {
    cardClass:
      "border-emerald-500/35 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
    valueClass: "text-emerald-300",
    emojiClass: "bg-emerald-500/20",
  },
  {
    cardClass:
      "border-indigo-500/35 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent shadow-[0_8px_24px_rgba(99,102,241,0.12)]",
    valueClass: "text-indigo-300",
    emojiClass: "bg-indigo-500/20",
  },
  {
    cardClass:
      "border-violet-500/35 bg-gradient-to-br from-violet-500/20 via-violet-500/5 to-transparent shadow-[0_8px_24px_rgba(139,92,246,0.12)]",
    valueClass: "text-violet-300",
    emojiClass: "bg-violet-500/20",
  },
  {
    cardClass:
      "border-cyan-500/35 bg-gradient-to-br from-cyan-500/20 via-cyan-500/5 to-transparent shadow-[0_8px_24px_rgba(6,182,212,0.12)]",
    valueClass: "text-cyan-300",
    emojiClass: "bg-cyan-500/20",
  },
  {
    cardClass:
      "border-amber-400/45 bg-gradient-to-br from-amber-500/18 via-amber-500/5 to-transparent shadow-[0_8px_24px_rgba(245,158,11,0.12)]",
    valueClass: "text-amber-300",
    emojiClass: "bg-amber-500/20",
  },
  {
    cardClass:
      "border-orange-500/45 bg-gradient-to-br from-orange-500/18 via-orange-500/5 to-transparent shadow-[0_8px_24px_rgba(249,115,22,0.12)]",
    valueClass: "text-orange-300",
    emojiClass: "bg-orange-500/20",
  },
] as const;

export const branchNameColorClass = (index: number) =>
  CARD_THEMES[index % CARD_THEMES.length].valueClass;

interface BranchMetricCardProps {
  branchName: string;
  branchIndex: number;
  sectionEmoji?: string;
  children: ReactNode;
}

export function BranchMetricRow({
  emoji,
  label,
  value,
  onValueClick,
  clickable,
}: {
  emoji?: string;
  label: string;
  value: React.ReactNode;
  onValueClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div className="bc-metric-row">
      <span className="bc-metric-row__label">
        {emoji ? <span aria-hidden>{emoji}</span> : null}
        {label}
      </span>
      {clickable && onValueClick ? (
        <button
          type="button"
          onClick={onValueClick}
          className="bc-metric-row__value bc-metric-row__value--clickable"
        >
          {value}
        </button>
      ) : (
        <span className="bc-metric-row__value">{value}</span>
      )}
    </div>
  );
}

export default function BranchMetricCard({
  branchName,
  branchIndex,
  sectionEmoji,
  children,
}: BranchMetricCardProps) {
  const theme = CARD_THEMES[branchIndex % CARD_THEMES.length];

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 h-full transition-all hover:-translate-y-0.5 ${theme.cardClass}`}>
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-extrabold text-white truncate">{branchName}</h3>
          {sectionEmoji ? (
            <p className="text-xs font-bold text-white/60 mt-0.5">{sectionEmoji} فرع</p>
          ) : null}
        </div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${theme.emojiClass}`}
          aria-hidden
        >
          {em.branch}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
