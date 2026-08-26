"use client";

import dynamic from "next/dynamic";

const ReportsChartsInner = dynamic(() => import("./ReportsChartsInner"), {
  ssr: false,
  loading: () => <div className="glass-card p-5 h-80 animate-pulse rounded-2xl" />,
});

interface ChartPoint {
  label: string;
  sales: number;
}

interface ComparePoint {
  name: string;
  value: number;
  fill: string;
}

interface ExpensePoint {
  name: string;
  value: number;
}

export default function ReportsCharts({
  salesChart,
  comparisonChart,
  expenseChart,
}: {
  salesChart: ChartPoint[];
  comparisonChart: ComparePoint[];
  expenseChart: ExpensePoint[];
}) {
  return (
    <ReportsChartsInner
      salesChart={salesChart}
      comparisonChart={comparisonChart}
      expenseChart={expenseChart}
    />
  );
}
