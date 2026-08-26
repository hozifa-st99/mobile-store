"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface TimelineField {
  emoji: string;
  label: string;
  value: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  documentNumber: string;
  date: string;
  partyName: string | null;
  detailUrl: string;
  summary: string;
  fields: TimelineField[];
}

interface CycleBlock {
  cycleIndex: number;
  serialId: string;
  status: string;
  statusLabel: string;
  deviceImeis: string[];
  enteredAt: string;
  entryFields: TimelineField[];
  events: TimelineEvent[];
}

interface TimelineResult {
  imei: string;
  cycles: CycleBlock[];
  current: {
    serialId: string;
    cycleIndex: number;
    status: string;
    statusLabel: string;
    deviceImeis: string[];
    summaryFields: TimelineField[];
  } | null;
}

const EVENT_META: Record<
  string,
  { emoji: string; accent: string; ring: string; badge: string }
> = {
  purchase: {
    emoji: "🚚",
    accent: "#6366f1",
    ring: "border-indigo-500/30 bg-indigo-500/10",
    badge: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  },
  stock_entry: {
    emoji: "📥",
    accent: "#06b6d4",
    ring: "border-cyan-500/30 bg-cyan-500/10",
    badge: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  },
  sale: {
    emoji: "🛒",
    accent: "#22c55e",
    ring: "border-emerald-500/30 bg-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  },
  sale_return: {
    emoji: "↩️",
    accent: "#f59e0b",
    ring: "border-amber-500/30 bg-amber-500/10",
    badge: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  },
  purchase_return: {
    emoji: "📤",
    accent: "#f97316",
    ring: "border-orange-500/30 bg-orange-500/10",
    badge: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  },
  stocktake: {
    emoji: "📋",
    accent: "#a855f7",
    ring: "border-violet-500/30 bg-violet-500/10",
    badge: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  },
};

const STATUS_THEME: Record<string, { emoji: string; shell: string; text: string }> = {
  available: {
    emoji: "✅",
    shell: "border-emerald-500/35 bg-emerald-500/10",
    text: "text-emerald-200",
  },
  sold: {
    emoji: "💸",
    shell: "border-sky-500/35 bg-sky-500/10",
    text: "text-sky-200",
  },
  removed: {
    emoji: "🚫",
    shell: "border-rose-500/35 bg-rose-500/10",
    text: "text-rose-200",
  },
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FieldGrid({ fields }: { fields: TimelineField[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div
          key={`${field.label}-${field.value}`}
          className="group rounded-xl border border-white/[0.06] bg-background-input/25 px-3 py-3 transition-all hover:border-primary/20 hover:bg-background-input/40"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg leading-none" aria-hidden>
              {field.emoji}
            </span>
            <p className="text-[11px] font-medium text-muted-dark">{field.label}</p>
          </div>
          <p className="break-words text-sm font-semibold text-white">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

function AnimatedBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="imei-tracker-orb imei-tracker-orb-1" />
      <div className="imei-tracker-orb imei-tracker-orb-2" />
      <div className="imei-tracker-orb imei-tracker-orb-3" />
      <div className="imei-tracker-grid" />
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          key={index}
          className="imei-tracker-particle"
          style={{
            left: `${(index * 17) % 100}%`,
            top: `${(index * 29) % 100}%`,
            animationDelay: `${index * 0.35}s`,
            animationDuration: `${4 + (index % 5)}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ImeiTrackerPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineResult | null>(null);
  const [searchedImei, setSearchedImei] = useState("");

  const currentTheme = useMemo(() => {
    const status = timeline?.current?.status ?? "available";
    return STATUS_THEME[status] ?? STATUS_THEME.available;
  }, [timeline?.current?.status]);

  const handleSearch = async () => {
    const imei = query.trim();
    if (!imei) {
      toast.error("أدخل رقم IMEI");
      return;
    }

    setLoading(true);
    const { ok, data, message } = await apiJson<{ timeline: TimelineResult }>(
      `/api/devices/timeline?imei=${encodeURIComponent(imei)}`
    );
    setLoading(false);

    if (!ok || !data.timeline) {
      setTimeline(null);
      setSearchedImei("");
      toast.error(message || "لا يوجد سجل لهذا الرقم");
      return;
    }

    setTimeline(data.timeline);
    setSearchedImei(data.timeline.imei);
  };

  return (
    <>
      <PageHeader
        title="تتبع IMEI"
        subtitle="استعلام فقط — تاريخ كامل للجهاز عبر كل دورة دخول"
      />

      <section className="relative mb-8 overflow-hidden rounded-3xl border border-primary/20 bg-background-card/70 p-6 sm:p-10 shadow-[0_20px_80px_rgba(99,57,249,0.12)]">
        <AnimatedBackdrop />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary-light">
            <span aria-hidden>📡</span>
            <span>بحث ذكي في دورة حياة الجهاز</span>
            <span aria-hidden>✨</span>
          </div>

          <h2 className="mb-2 text-2xl font-extrabold text-white sm:text-3xl">
            🔍 تتبع رقم IMEI
          </h2>
          <p className="mb-8 text-sm text-muted sm:text-base">
            اكتب رقم IMEI وشوف الحالة الحالية + كل الدورات والحركات من أول دخول
          </p>

          <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-lg">
                📱
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSearch();
                }}
                placeholder="اكتب IMEI هنا..."
                inputMode="numeric"
                className="h-14 w-full rounded-2xl border border-primary/25 bg-background-input/80 pe-4 ps-12 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(99,57,249,0.08)] outline-none transition-all placeholder:text-muted focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(99,57,249,0.15)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loading}
              className="inline-flex h-14 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-primary to-primary-light px-6 text-sm font-bold text-white shadow-glow-sm transition-all hover:scale-[1.02] hover:shadow-glow disabled:opacity-60"
            >
              <span aria-hidden>{loading ? "⏳" : "🔎"}</span>
              {loading ? "جاري البحث..." : "بحث"}
            </button>
          </div>
        </div>
      </section>

      {!timeline && !loading && (
        <div className="glass-card p-8 text-center">
          <p className="text-4xl mb-3" aria-hidden>
            🛰️
          </p>
          <p className="text-sm text-muted">
            أدخل IMEI واضغط بحث لعرض التاريخ الكامل للجهاز
          </p>
        </div>
      )}

      {timeline?.current && (
        <section
          className={`relative mb-8 overflow-hidden rounded-3xl border p-5 sm:p-6 ${currentTheme.shell}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">الحالة الحالية</p>
              <h3 className={`mt-1 text-xl font-extrabold ${currentTheme.text}`}>
                {currentTheme.emoji} {timeline.current.statusLabel}
              </h3>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-start">
              <p className="text-[11px] text-muted">IMEI المُبحَث عنه</p>
              <p className="font-mono text-sm font-bold text-white">{searchedImei}</p>
            </div>
          </div>
          <FieldGrid fields={timeline.current.summaryFields} />
        </section>
      )}

      {timeline?.cycles.map((cycle) => {
        const cycleTheme = STATUS_THEME[cycle.status] ?? STATUS_THEME.available;

        return (
          <section key={cycle.serialId} className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2">
                <span className="text-lg" aria-hidden>
                  🔄
                </span>
                <div>
                  <p className="text-[11px] text-violet-200/80">الدورة</p>
                  <p className="text-sm font-extrabold text-violet-100">#{cycle.cycleIndex}</p>
                </div>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 ${cycleTheme.shell}`}
              >
                <span aria-hidden>{cycleTheme.emoji}</span>
                <span className={`text-sm font-bold ${cycleTheme.text}`}>{cycle.statusLabel}</span>
              </div>
              <p className="text-xs text-muted">
                📅 دخول الدورة: {formatDateTime(cycle.enteredAt)}
              </p>
            </div>

            <div className="glass-card mb-5 p-5">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <span aria-hidden>📦</span>
                بيانات الجهاز عند دخول هذه الدورة
              </h4>
              <FieldGrid fields={cycle.entryFields} />
            </div>

            <div className="relative ps-2 sm:ps-6">
              <div className="absolute bottom-0 start-[1.1rem] top-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

              {cycle.events.length === 0 ? (
                <div className="glass-card p-5 text-sm text-muted">
                  لا توجد حركات إضافية مسجّلة بعد الدخول في هذه الدورة
                </div>
              ) : (
                cycle.events.map((event, index) => {
                  const meta = EVENT_META[event.type] ?? EVENT_META.purchase;

                  return (
                    <article key={event.id} className="relative mb-5 ps-10 sm:ps-12">
                      <div
                        className={`absolute start-0 top-5 flex h-9 w-9 items-center justify-center rounded-full border text-base shadow-lg ${meta.ring}`}
                      >
                        {meta.emoji}
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background-card/80 p-4 sm:p-5 transition-all hover:border-primary/25">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}
                              >
                                {event.typeLabel}
                              </span>
                              <span
                                className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                                  event.direction === "in"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                                }`}
                              >
                                {event.direction === "in" ? "⬇️ دخول" : "⬆️ خروج"}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-white">{event.summary}</p>
                            <p className="mt-1 text-xs text-muted">
                              📄 {event.documentNumber}
                              {event.partyName ? ` — ${event.partyName}` : ""}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="text-[11px] text-muted">التاريخ</p>
                            <p className="text-xs font-semibold text-white">
                              {formatDateTime(event.date)}
                            </p>
                          </div>
                        </div>

                        <FieldGrid fields={event.fields} />

                        <div className="mt-4 flex justify-end">
                          <Link
                            href={event.detailUrl}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-light transition-all hover:bg-primary/20"
                          >
                            <span aria-hidden>👁️</span>
                            عرض المستند
                          </Link>
                        </div>
                      </div>

                      {index < cycle.events.length - 1 && (
                        <div className="mt-2 ps-1 text-[11px] text-muted">⬇️</div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
