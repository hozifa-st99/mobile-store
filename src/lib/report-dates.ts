export type ReportPeriodPreset = "week" | "month" | "year";

export interface ReportDateRange {
  from: string;
  to: string;
  label: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** عدد أيام الفترة شاملًا (يوم البداية + يوم النهاية) */
export function inclusivePeriodDays(from: Date | string, to: Date | string): number {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function resolveReportRange(params: {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  month?: string | null;
}): ReportDateRange {
  const now = new Date();

  if (params.from && params.to) {
    const from = startOfDay(new Date(params.from));
    const to = endOfDay(new Date(params.to));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${from.toLocaleDateString("ar-EG")} — ${to.toLocaleDateString("ar-EG")}`,
    };
  }

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = endOfDay(new Date(y, m, 0));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: from.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
    };
  }

  const period = (params.period || "month") as ReportPeriodPreset;

  if (period === "week") {
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: "آخر 7 أيام",
    };
  }

  if (period === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: `سنة ${now.getFullYear()}`,
    };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString(),
    to: endOfDay(now).toISOString(),
    label: from.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
  };
}

export function buildChartBuckets(fromIso: string, toIso: string) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(new Date(toIso));
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);

  const buckets: { key: string; label: string }[] = [];

  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = startOfDay(d).toISOString();
      buckets.push({
        key,
        label: d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }),
      });
    }
  } else if (days <= 120) {
    let cursor = startOfDay(from);
    while (cursor <= to) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const key = cursor.toISOString();
      buckets.push({
        key,
        label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
      });
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      buckets.push({
        key: cursor.toISOString(),
        label: cursor.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" }),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  return buckets;
}

export function bucketDate(date: Date, fromIso: string, toIso: string) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(new Date(toIso));
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const d = startOfDay(date);

  if (days <= 31) return d.toISOString();

  if (days <= 120) {
    const diff = Math.floor((d.getTime() - from.getTime()) / 86400000);
    const weekStart = new Date(from);
    weekStart.setDate(from.getDate() + Math.floor(diff / 7) * 7);
    return startOfDay(weekStart).toISOString();
  }

  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
