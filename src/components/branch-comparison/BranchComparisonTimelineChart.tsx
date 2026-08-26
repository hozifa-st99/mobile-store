"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Row {
  branchId: string;
  branchName: string;
  timeSeries: { label: string; sales: number }[];
}

const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

function TimelineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2.5 shadow-xl min-w-[10rem]">
      <p className="text-xs font-bold text-muted mb-2">📅 {label}</p>
      <p className="text-[10px] font-bold text-primary-light mb-1.5">صافي المبيعات (ج.م)</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 text-sm py-0.5">
          <span className="font-bold text-white inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-extrabold tabular-nums text-emerald-300">
            {formatCurrency(entry.value)} ج.م
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BranchComparisonTimelineChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-8">اختر فرعًا واحدًا على الأقل للرسم البياني</p>
    );
  }

  const labels = rows[0]?.timeSeries.map((p) => p.label) ?? [];
  const chartData = labels.map((label, i) => {
    const point: Record<string, string | number> = { label };
    for (const row of rows) {
      point[row.branchName] = row.timeSeries[i]?.sales ?? 0;
    }
    return point;
  });

  return (
    <div className="glass-card p-4">
      <p className="text-xs font-bold text-muted mb-3">📈 صافي المبيعات لكل فرع عبر الفترة — مرّر على النقطة لعرض القيمة</p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<TimelineTooltip />} />
            <Legend formatter={(value) => `🏢 ${value}`} />
            {rows.map((row, i) => (
              <Line
                key={row.branchId}
                type="monotone"
                dataKey={row.branchName}
                name={row.branchName}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
