import type { ReportFilterState } from "@/components/reports/ReportDateFilter";

const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

export function buildReportQuery(filter: ReportFilterState): string {
  const params = new URLSearchParams();
  if (filter.mode === "preset") {
    params.set("period", filter.period);
  } else if (filter.mode === "month") {
    params.set("month", filter.month || defaultMonth);
  } else if (filter.from && filter.to) {
    params.set("from", filter.from);
    params.set("to", filter.to);
  }
  return params.toString();
}

export function appendReportQuery(base: string, filter: ReportFilterState): string {
  const q = buildReportQuery(filter);
  if (!q) return base;
  return base.includes("?") ? `${base}&${q}` : `${base}?${q}`;
}
