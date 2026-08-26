"use client";

import { toDateInput } from "@/lib/report-dates";
import { ClearFilterButton } from "@/components/ui/FilterControls";

export type BranchComparisonPeriod =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "half"
  | "year"
  | "custom";

export type BranchComparisonCompareMode =
  | "none"
  | "previous"
  | "prev_month"
  | "prev_year"
  | "custom";

export interface BranchComparisonFilterState {
  period: BranchComparisonPeriod;
  from: string;
  to: string;
  month: string;
  compare: BranchComparisonCompareMode;
  compareFrom: string;
  compareTo: string;
  branchIds: string[];
}

interface BranchComparisonFilterProps {
  value: BranchComparisonFilterState;
  branches: { id: string; name: string }[];
  onChange: (next: BranchComparisonFilterState) => void;
  onApply: () => void;
  onReset?: () => void;
  loading?: boolean;
  rangeLabel?: string;
}

const periodOptions: { id: BranchComparisonPeriod; label: string; emoji: string }[] = [
  { id: "day", label: "يومي", emoji: "☀️" },
  { id: "week", label: "أسبوعي", emoji: "📅" },
  { id: "month", label: "شهري", emoji: "🗓️" },
  { id: "quarter", label: "ربع سنوي", emoji: "📊" },
  { id: "half", label: "نص سنوي", emoji: "📆" },
  { id: "year", label: "سنوي", emoji: "🎯" },
  { id: "custom", label: "فترة مخصصة", emoji: "✏️" },
];

const compareOptions: { id: BranchComparisonCompareMode; label: string }[] = [
  { id: "none", label: "بدون مقارنة" },
  { id: "previous", label: "الفترة السابقة" },
  { id: "prev_month", label: "نفس الفترة — الشهر السابق" },
  { id: "prev_year", label: "نفس الفترة — السنة السابقة" },
  { id: "custom", label: "فترة مخصصة أخرى" },
];

const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

export function buildBranchComparisonQuery(filter: BranchComparisonFilterState): string {
  const params = new URLSearchParams();
  const today = toDateInput(new Date());

  if (filter.period === "custom" && filter.from && filter.to) {
    params.set("from", filter.from);
    params.set("to", filter.to);
  } else if (filter.period === "month") {
    params.set("month", filter.month || defaultMonth);
  } else if (filter.period === "day") {
    params.set("from", today);
    params.set("to", today);
  } else if (filter.period === "week") {
    params.set("period", "week");
  } else if (filter.period === "year") {
    params.set("period", "year");
  } else if (filter.period === "quarter") {
    const d = new Date();
    const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    params.set("from", toDateInput(qStart));
    params.set("to", today);
  } else if (filter.period === "half") {
    const d = new Date();
    const hStart = new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
    params.set("from", toDateInput(hStart));
    params.set("to", today);
  }

  if (filter.compare !== "none") {
    params.set("compare", filter.compare);
    if (filter.compare === "custom" && filter.compareFrom && filter.compareTo) {
      params.set("compareFrom", filter.compareFrom);
      params.set("compareTo", filter.compareTo);
    }
  }

  if (filter.branchIds.length > 0) {
    params.set("branchIds", filter.branchIds.join(","));
  }

  return params.toString();
}

export default function BranchComparisonFilter({
  value,
  branches,
  onChange,
  onApply,
  onReset,
  loading,
  rangeLabel,
}: BranchComparisonFilterProps) {
  const today = toDateInput(new Date());
  const allSelected = value.branchIds.length === 0 || value.branchIds.length === branches.length;
  const isDefault =
    JSON.stringify(value) === JSON.stringify(createDefaultBranchComparisonFilter());

  const toggleBranch = (id: string) => {
    const set = new Set(value.branchIds.length ? value.branchIds : branches.map((b) => b.id));
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const nextIds = Array.from(set);
    if (nextIds.length === 0 || nextIds.length === branches.length) {
      onChange({ ...value, branchIds: [] });
      return;
    }
    onChange({ ...value, branchIds: nextIds });
  };

  const selectAll = () => onChange({ ...value, branchIds: [] });

  return (
    <div className="glass-card p-4 mb-6 space-y-4 branch-comparison-filter">
      <div>
        <p className="section-title">🏆 فترة المقارنة</p>
        {rangeLabel && (
          <p className="text-sm font-semibold text-primary-light mt-1">{rangeLabel}</p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {periodOptions.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ ...value, period: p.id })}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
              value.period === p.id
                ? "bg-primary text-white shadow-glow-sm"
                : "border border-border text-muted hover:text-white"
            }`}
          >
            <span>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      {value.period === "month" && (
        <input
          type="month"
          value={value.month || defaultMonth}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
          className="glass-input w-full sm:w-56"
        />
      )}

      {value.period === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div>
            <label className="text-xs font-bold text-muted block mb-2">تاريخ البداية</label>
            <input
              type="date"
              max={value.to || today}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted block mb-2">تاريخ النهاية</label>
            <input
              type="date"
              min={value.from}
              max={today}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="glass-input"
            />
          </div>
        </div>
      )}

      <div className="luxury-section-divider" />

      <div>
        <p className="text-xs font-bold text-muted mb-2">مقارنة مع</p>
        <div className="flex gap-2 flex-wrap">
          {compareOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange({ ...value, compare: c.id })}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                value.compare === c.id
                  ? "bg-accent-green/20 text-white border border-accent-green/40"
                  : "border border-border text-muted hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {value.compare === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <div>
            <label className="text-xs font-bold text-muted block mb-2">بداية المقارنة</label>
            <input
              type="date"
              value={value.compareFrom}
              onChange={(e) => onChange({ ...value, compareFrom: e.target.value })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted block mb-2">نهاية المقارنة</label>
            <input
              type="date"
              value={value.compareTo}
              onChange={(e) => onChange({ ...value, compareTo: e.target.value })}
              className="glass-input"
            />
          </div>
        </div>
      )}

      <div className="luxury-section-divider" />

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-muted">الفروع</p>
          <button type="button" onClick={selectAll} className="text-xs font-bold text-primary-light">
            {allSelected ? "كل الفروع" : "تحديد الكل"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {branches.map((b) => {
            const selected =
              value.branchIds.length === 0 || value.branchIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBranch(b.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  selected
                    ? "bg-primary/20 text-white border border-primary/40"
                    : "border border-border text-muted opacity-60"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bc-filter-apply-bar flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <button type="button" onClick={onApply} disabled={loading} className="btn-primary w-full sm:w-auto sm:min-w-[8rem]">
          {loading ? "جاري التحميل…" : "تطبيق الفترة"}
        </button>
        {onReset && !isDefault ? (
          <ClearFilterButton onClick={onReset} label="إلغاء الفلتر" />
        ) : null}
      </div>
    </div>
  );
}

export function createDefaultBranchComparisonFilter(): BranchComparisonFilterState {
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  return {
    period: "month",
    from: "",
    to: "",
    month,
    compare: "previous",
    compareFrom: "",
    compareTo: "",
    branchIds: [],
  };
}

export const defaultBranchComparisonFilter: BranchComparisonFilterState =
  createDefaultBranchComparisonFilter();
