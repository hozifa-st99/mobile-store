"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";

function HourlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: { sales?: number; profit?: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const sales = Number(point?.sales ?? 0);
  const profit = Number(point?.profit ?? 0);

  return (
    <div className="rounded-xl border border-white/10 bg-[#121432] px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-bold text-primary-light mb-2">{label}</p>
      <p className="text-muted">
        صافي المبيعات:{" "}
        <span className="font-semibold text-white tabular-nums">
          {formatCurrency(sales)} ج.م
        </span>
      </p>
      <p className="text-muted mt-1">
        صافي الربح:{" "}
        <span
          className={`font-semibold tabular-nums ${
            profit >= 0 ? "text-accent-green" : "text-red-400"
          }`}
        >
          {formatCurrency(profit)} ج.م
        </span>
      </p>
    </div>
  );
}

export default function OpenShiftHourlyChart() {
  const { openShiftHourlyChart: data, kpis } = useDashboard();
  const chartData = data.length ? data : [{ hour: "—", hourKey: 0, sales: 0, profit: 0 }];

  return (
    <div className="glass-card-shift p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="section-title">مبيعات الوردية الحالية</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-2xl font-bold text-white">
              {formatCurrency(kpis.shiftSales)}{" "}
              <span className="text-sm text-muted font-normal">ج.م</span>
            </span>
            <span className="text-xs font-semibold text-muted bg-white/5 border border-border px-2 py-0.5 rounded-full">
              وردية لم تُقفل
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            صافي ربح الوردية:{" "}
            <span className="font-semibold text-accent-green tabular-nums">
              {formatCurrency(kpis.shiftProfit)} ج.م
            </span>
          </p>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="openShiftSalesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
            />
            <Tooltip content={<HourlyTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#openShiftSalesGradient)"
              dot={{ fill: "#7c3aed", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#7c3aed", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
