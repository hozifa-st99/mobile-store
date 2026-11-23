export type ReportPeriodPreset = "week" | "month" | "year";

export interface ReportDateRange {
  from: string;
  to: string;
  label: string;
}

/** نفس منطق عرض تواريخ المستندات — تقارير تُقسَّم بتقويم مصر */
const CAIRO_TZ = "Africa/Cairo";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type CairoParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readCairoParts(d: Date): CairoParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** لحظة UTC حين تكون الساعة في القاهرة = القيم المطلوبة */
function cairoWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  let probe = Date.UTC(year, month - 1, day, hour - 4, minute, second, 0);
  const end = probe + 8 * 60 * 60 * 1000;

  while (probe <= end) {
    const p = readCairoParts(new Date(probe));
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute &&
      p.second === second
    ) {
      return new Date(probe + millisecond);
    }
    probe += 60_000;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 2, minute, second, millisecond));
}

function parseCairoDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return startOfDay(new Date(value));
  return cairoWallClockToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0, 0);
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function cairoDayDiff(from: Date, to: Date): number {
  const a = readCairoParts(startOfDay(from));
  const b = readCairoParts(startOfDay(to));
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

function addCairoDays(start: Date, days: number): Date {
  const base = readCairoParts(startOfDay(start));
  const shifted = new Date(Date.UTC(base.year, base.month - 1, base.day + days));
  return cairoWallClockToUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

function formatCairoDate(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString("ar-EG", { timeZone: CAIRO_TZ, ...opts });
}

export function toDateInput(d: Date) {
  const p = readCairoParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function startOfDay(d: Date) {
  const p = readCairoParts(d);
  return cairoWallClockToUtc(p.year, p.month, p.day, 0, 0, 0, 0);
}

export function endOfDay(d: Date) {
  const p = readCairoParts(d);
  const secondMatch = cairoWallClockToUtc(p.year, p.month, p.day, 23, 59, 59, 0);
  return new Date(secondMatch.getTime() + 999);
}

/** عدد أيام الفترة شاملًا (يوم البداية + يوم النهاية) — بتقويم القاهرة */
export function inclusivePeriodDays(from: Date | string, to: Date | string): number {
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  return Math.max(1, cairoDayDiff(start, end) + 1);
}

export function resolveReportRange(params: {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  month?: string | null;
}): ReportDateRange {
  const now = new Date();
  const nowCairo = readCairoParts(now);

  if (params.from && params.to) {
    const from = parseCairoDateInput(params.from);
    const to = endOfDay(parseCairoDateInput(params.to));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${formatCairoDate(from)} — ${formatCairoDate(parseCairoDateInput(params.to))}`,
    };
  }

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    const from = cairoWallClockToUtc(y, m, 1, 0, 0, 0, 0);
    const lastDay = lastDayOfMonth(y, m);
    const to = endOfDay(cairoWallClockToUtc(y, m, lastDay, 12, 0, 0, 0));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: formatCairoDate(from, { month: "long", year: "numeric" }),
    };
  }

  const period = (params.period || "month") as ReportPeriodPreset;

  if (period === "week") {
    const todayStart = startOfDay(now);
    const from = addCairoDays(todayStart, -6);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: "آخر 7 أيام",
    };
  }

  if (period === "year") {
    const from = cairoWallClockToUtc(nowCairo.year, 1, 1, 0, 0, 0, 0);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: `سنة ${nowCairo.year}`,
    };
  }

  const from = cairoWallClockToUtc(nowCairo.year, nowCairo.month, 1, 0, 0, 0, 0);
  return {
    from: from.toISOString(),
    to: endOfDay(now).toISOString(),
    label: formatCairoDate(from, { month: "long", year: "numeric" }),
  };
}

export function buildChartBuckets(fromIso: string, toIso: string) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(new Date(toIso));
  const days = Math.max(1, cairoDayDiff(from, to) + 1);

  const buckets: { key: string; label: string }[] = [];

  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const dayStart = addCairoDays(from, i);
      const key = dayStart.toISOString();
      buckets.push({
        key,
        label: formatCairoDate(dayStart, { day: "numeric", month: "short" }),
      });
    }
  } else if (days <= 120) {
    let cursor = startOfDay(from);
    const toEnd = startOfDay(to);
    while (cursor.getTime() <= toEnd.getTime()) {
      const key = cursor.toISOString();
      const p = readCairoParts(cursor);
      buckets.push({
        key,
        label: `${p.day}/${p.month}`,
      });
      cursor = addCairoDays(cursor, 7);
    }
  } else {
    let y = readCairoParts(from).year;
    let m = readCairoParts(from).month;
    const endParts = readCairoParts(to);
    while (y < endParts.year || (y === endParts.year && m <= endParts.month)) {
      const monthStart = cairoWallClockToUtc(y, m, 1, 0, 0, 0, 0);
      buckets.push({
        key: monthStart.toISOString(),
        label: formatCairoDate(monthStart, { month: "short", year: "2-digit" }),
      });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }

  return buckets;
}

export function bucketDate(date: Date, fromIso: string, toIso: string) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(new Date(toIso));
  const days = Math.max(1, cairoDayDiff(from, to) + 1);
  const d = startOfDay(date);

  if (days <= 31) return d.toISOString();

  if (days <= 120) {
    const diff = cairoDayDiff(from, d);
    const weekStart = addCairoDays(from, Math.floor(diff / 7) * 7);
    return startOfDay(weekStart).toISOString();
  }

  const p = readCairoParts(d);
  return startOfDay(cairoWallClockToUtc(p.year, p.month, 1, 0, 0, 0, 0)).toISOString();
}