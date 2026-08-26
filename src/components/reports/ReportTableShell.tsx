"use client";

import type { ReactNode } from "react";

import { CellEmoji, ThEmoji } from "@/components/ui/TableEmoji";

interface ReportTableShellProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterSlot?: ReactNode;
  toolbarExtra?: ReactNode;
  sortSlot?: ReactNode;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export default function ReportTableShell({
  search,
  onSearchChange,
  searchPlaceholder = "بحث...",
  filterSlot,
  toolbarExtra,
  sortSlot,
  children,
  emptyMessage = "لا توجد بيانات",
  isEmpty,
}: ReportTableShellProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="glass-input w-full sm:max-w-xs"
          />
          {filterSlot}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sortSlot}
          {toolbarExtra}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border border-border/40 bg-background-card/40 p-10 text-center text-muted font-semibold">
          {emptyMessage}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 overflow-hidden bg-background-card/30">
          <div className="overflow-x-auto">{children}</div>
        </div>
      )}
    </div>
  );
}

export { ThEmoji, CellEmoji };
