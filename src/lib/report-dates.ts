export type ReportPeriodPreset = "week" | "month" | "year";

export interface ReportDateRange {
  from: string;
  to: string;
  label: string;
}

/** نفس منطق عرض تواريخ المستندات — تقارير تُقسَّم بتقويم مصر */
const CAIRO_TZ = "Africa/Cairo";

const cairoDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const cairoYmdFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

type CairoYmd = { year: number; month: number; day: number };

/** لحظة UTC لساعة محددة على جدار القاهرة — cache + بحث ثنائي (بدل لف دقائق) */
const wallClockCache = new Map<string, number>();

/** نفس from/to في طلب التقرير — يُحسب مرة واحدة */
const rangeContextCache = new Map<string, { from: Date; to: Date; days: number }>();

function parseFormatterParts(
  parts: Intl.DateTimeFormatPart[],
  fields: Intl.DateTimeFormatPartTypes[]
): number[] {
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return fields.map((type) => get(type));
}

function readCairoParts(d: Date): CairoParts {
  const [year, month, day, hour, minute, second] = parseFormatterParts(
    cairoDateTimeFormatter.formatToParts(d),
    ["year", "month", "day", "hour", "minute", "second"]
  );
  return { year, month, day, hour, minute, second };
}

function readCairoYmd(d: Date): CairoYmd {
  const [year, month, day] = parseFormatterParts(cairoYmdFormatter.formatToParts(d), [
    "year",
    "month",
    "day",
  ]);
  return { year, month, day };
}

function compareCairoWall(
  p: CairoParts,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  if (p.year !== year) return p.year - year;
  if (p.month !== month) return p.month - month;
  if (p.day !== day) return p.day - day;
  if (p.hour !== hour) return p.hour - hour;
  if (p.minute !== minute) return p.minute - minute;
  return p.second - second;
}

function cairoWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  const cacheKey = `${year}-${pad(month)}-${pad(day)}T${hour}:${minute}:${second}`;
  let utcMs = wallClockCache.get(cacheKey);

  if (utcMs === undefined) {
    let lo = Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0);
    let hi = Date.UTC(year, month - 1, day + 1, 23, 59, 59, 999);

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cmp = compareCairoWall(readCairoParts(new Date(mid)), year, month, day, hour, minute, second);
      if (cmp === 0) {
        utcMs = mid;
        while (utcMs > lo) {
          const prev = utcMs - 1;
          if (compareCairoWall(readCairoParts(new Date(prev)), year, month, day, hour, minute, second) !== 0) {
            break;
          }
          utcMs = prev;
        }
        wallClockCache.set(cacheKey, utcMs);
        break;
      }
      if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }

    if (utcMs === undefined) {
      utcMs = Date.UTC(year, month - 1, day, hour - 2, minute, second, 0);
      wallClockCache.set(cacheKey, utcMs);
    }
  }

  return new Date(utcMs + millisecond);
}

function getCairoDayStartFromYmd(year: number, month: number, day: number): Date {
  return cairoWallClockToUtc(year, month, day, 0, 0, 0, 0);
}

function getCairoDayStartFromInstant(d: Date): Date {
  const ymd = readCairoYmd(d);
  return getCairoDayStartFromYmd(ymd.year, ymd.month, ymd.day);
}

function parseCairoDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return startOfDay(new Date(value));
  return getCairoDayStartFromYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function cairoDayDiff(from: Date, to: Date): number {
  const a = readCairoYmd(from);
  const b = readCairoYmd(to);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

function addCairoDays(start: Date, days: number): Date {
  const base = readCairoYmd(startOfDay(start));
  const shifted = new Date(Date.UTC(base.year, base.month - 1, base.day + days));
  return getCairoDayStartFromYmd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

function formatCairoDate(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString("ar-EG", { timeZone: CAIRO_TZ, ...opts });
}

function getRangeContext(fromIso: string, toIso: string) {
  const key = `${fromIso}|${toIso}`;
  let ctx = rangeContextCache.get(key);
  if (!ctx) {
    const from = startOfDay(new Date(fromIso));
    const to = startOfDay(new Date(toIso));
    const days = Math.max(1, cairoDayDiff(from, to) + 1);
    ctx = { from, to, days };
    rangeContextCache.set(key, ctx);
    if (rangeContextCache.size > 64) {
      const first = rangeContextCache.keys().next().value;
      if (first) rangeContextCache.delete(first);
    }
  }
  return ctx;
}

export function toDateInput(d: Date) {
  const { year, month, day } = readCairoYmd(d);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function startOfDay(d: Date) {
  return getCairoDayStartFromInstant(d);
}

export function endOfDay(d: Date) {
  const { year, month, day } = readCairoYmd(d);
  const secondMatch = cairoWallClockToUtc(year, month, day, 23, 59, 59, 0);
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
  const nowCairo = readCairoYmd(now);

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
    const from = getCairoDayStartFromYmd(y, m, 1);
    const lastDay = lastDayOfMonth(y, m);
    const to = endOfDay(getCairoDayStartFromYmd(y, m, lastDay));
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
    const from = getCairoDayStartFromYmd(nowCairo.year, 1, 1);
    return {
      from: from.toISOString(),
      to: endOfDay(now).toISOString(),
      label: `سنة ${nowCairo.year}`,
    };
  }

  const from = getCairoDayStartFromYmd(nowCairo.year, nowCairo.month, 1);
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
      const p = readCairoYmd(cursor);
      buckets.push({
        key,
        label: `${p.day}/${p.month}`,
      });
      cursor = addCairoDays(cursor, 7);
    }
  } else {
    let y = readCairoYmd(from).year;
    let m = readCairoYmd(from).month;
    const endParts = readCairoYmd(to);
    while (y < endParts.year || (y === endParts.year && m <= endParts.month)) {
      const monthStart = getCairoDayStartFromYmd(y, m, 1);
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
  const { from, days } = getRangeContext(fromIso, toIso);
  const d = getCairoDayStartFromInstant(date);

  if (days <= 31) return d.toISOString();

  if (days <= 120) {
    const diff = cairoDayDiff(from, d);
    const weekStart = addCairoDays(from, Math.floor(diff / 7) * 7);
    return startOfDay(weekStart).toISOString();
  }

  const p = readCairoYmd(d);
  return getCairoDayStartFromYmd(p.year, p.month, 1).toISOString();
}