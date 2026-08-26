"use client";

import { useState } from "react";
import { toDateInput } from "@/lib/report-dates";

export type FilterMode = "preset" | "month" | "range";

export interface ReportFilterState {
  mode: FilterMode;
  period: "week" | "month" | "year";
  month: string;
  from: string;
  to: string;
}

interface ReportDateFilterProps {
  value: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  onApply: () => void;
  loading?: boolean;
  rangeLabel?: string;
}

const presets = [
  { id: "week" as const, label: "أسبوع", emoji: "📅" },
  { id: "month" as const, label: "شهر", emoji: "🗓️" },
  { id: "year" as const, label: "سنة", emoji: "📆" },
];

export default function ReportDateFilter({
  value,
  onChange,
  onApply,
  loading,
  rangeLabel,
}: ReportDateFilterProps) {
  const [mode, setMode] = useState<FilterMode>(value.mode);

  const today = toDateInput(new Date());
  const monthDefault = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="glass-card p-4 mb-6 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="section-title">فترة التقرير</p>
          {rangeLabel && <p className="text-sm font-semibold text-primary-light mt-1">{rangeLabel}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { id: "preset", label: "سريع", emoji: "⚡" },
              { id: "month", label: "شهر محدد", emoji: "🗓️" },
              { id: "range", label: "من — إلى", emoji: "📆" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                onChange({ ...value, mode: m.id });
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                mode === m.id
                  ? "bg-primary text-white shadow-glow-sm"
                  : "border border-border text-muted hover:text-white"
              }`}
            >
              <span>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "preset" && (
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...value, mode: "preset", period: p.id })}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                value.period === p.id && value.mode === "preset"
                  ? "bg-accent-green/20 text-white border border-accent-green/40"
                  : "border border-border text-muted hover:text-white"
              }`}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {mode === "month" && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div>
            <label className="text-xs font-bold text-muted block mb-2">اختر الشهر</label>
            <input
              type="month"
              value={value.month || monthDefault}
              onChange={(e) => onChange({ ...value, mode: "month", month: e.target.value })}
              className="glass-input w-full sm:w-56"
            />
          </div>
        </div>
      )}

      {mode === "range" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div>
            <label className="text-xs font-bold text-muted block mb-2">من تاريخ</label>
            <input
              type="date"
              max={value.to || today}
              value={value.from}
              onChange={(e) => onChange({ ...value, mode: "range", from: e.target.value })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted block mb-2">إلى تاريخ</label>
            <input
              type="date"
              min={value.from}
              max={today}
              value={value.to}
              onChange={(e) => onChange({ ...value, mode: "range", to: e.target.value })}
              className="glass-input"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onApply}
        disabled={loading || (mode === "range" && (!value.from || !value.to))}
        className="btn-primary max-w-xs py-3"
      >
        {loading ? "جاري التحميل..." : "عرض التقرير"}
      </button>
    </div>
  );
}
