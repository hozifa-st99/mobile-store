"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { em } from "@/components/ui/TableEmoji";

const categoryLabels: Record<string, string> = {
  rent: "إيجار",
  utilities: "مرافق",
  salary: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
};

const pieColors = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

const chartTooltipStyle = {
  contentStyle: {
    background: "#121432",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
  },
  labelStyle: {
    color: "#e8edf5",
    fontWeight: 800,
    fontSize: "13px",
    marginBottom: "4px",
  },
  itemStyle: {
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
  },
};

interface Props {
  salesChart: { label: string; sales: number }[];
  comparisonChart: { name: string; value: number; fill: string }[];
  expenseChart: { name: string; value: number }[];
}

export default function ReportsChartsInner({
  salesChart,
  comparisonChart,
  expenseChart,
}: Props) {
  const expenseData = expenseChart.map((e) => ({
    name: categoryLabels[e.name] || e.name,
    value: e.value,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
      <div className="glass-card p-5 xl:col-span-2">
        <h2 className="section-title mb-4 inline-flex items-center gap-2">
          <span>{em.report}</span>
          منحنى المبيعات
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesChart}>
              <defs>
                <linearGradient id="reportSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#b8c5d6", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#b8c5d6", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number) => [`${formatCurrency(value)} ج.م`, "المبيعات"]}
              />
              <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.5} fill="url(#reportSalesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="section-title mb-4 inline-flex items-center gap-2">
          <span>{em.total}</span>
          مقارنة الإيرادات والمصروفات
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonChart} barSize={42}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#b8c5d6", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#b8c5d6", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value: number, name: string) => [`${formatCurrency(value)} ج.م`, name]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {comparisonChart.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="section-title mb-4 inline-flex items-center gap-2">
          <span>{em.category}</span>
          توزيع المصروفات
        </h2>
        <div className="h-56">
          {expenseData.length === 0 ? (
            <p className="text-center text-muted font-semibold pt-16">لا توجد مصروفات في هذه الفترة</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {expenseData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(value: number, name: string) => [`${formatCurrency(value)} ج.م`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700, color: "#e8edf5" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
