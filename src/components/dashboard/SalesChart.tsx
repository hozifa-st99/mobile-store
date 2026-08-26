"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";

export default function SalesChart() {
  const { salesChart: data } = useDashboard();
  const weekTotal = data.reduce((s, p) => s + p.sales, 0);
  const chartData = data.length ? data : [{ day: "—", sales: 0 }];

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="section-title">نظرة عامة على المبيعات</h2>
          <p className="text-xs text-muted mt-1">صافي المبيعات بعد خصم المرتجعات</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold text-white">
              {formatCurrency(weekTotal)}{" "}
              <span className="text-sm text-muted font-normal">ج.م</span>
            </span>
            <span className="text-xs font-semibold text-muted bg-white/5 border border-border px-2 py-0.5 rounded-full">
              آخر 7 أيام
            </span>
          </div>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
            />
            <Tooltip
              contentStyle={{
                background: "#121432",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${formatCurrency(value)} ج.م`, "صافي المبيعات"]}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#7c3aed"
              strokeWidth={2.5}
              fill="url(#salesGradient)"
              dot={{ fill: "#7c3aed", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#7c3aed", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
