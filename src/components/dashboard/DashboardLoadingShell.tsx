"use client";

export default function DashboardLoadingShell() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/15 via-violet-600/10 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/30">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-2xl bg-primary/20 opacity-40" />
            <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary-light" />
          </span>
          <div>
            <p className="text-sm font-bold text-white">جاري تحميل لوحة التحكم</p>
            <p className="text-xs text-muted mt-0.5">نجهّز أرقام الفرع المختار...</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="glass-card h-32 animate-pulse rounded-2xl" />
        ))}
      </div>

      <div className="glass-card h-28 animate-pulse rounded-2xl" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-card h-24 animate-pulse rounded-2xl" />
        <div className="glass-card h-24 animate-pulse rounded-2xl" />
      </div>

      <div className="glass-card h-40 animate-pulse rounded-2xl" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-card h-64 animate-pulse rounded-2xl" />
        <div className="glass-card h-64 animate-pulse rounded-2xl" />
      </div>

      <div className="glass-card h-72 animate-pulse rounded-2xl" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-card h-72 animate-pulse rounded-2xl" />
        <div className="glass-card h-72 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

function DashboardRefreshBanner() {
  return (
    <div className="mb-5 rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-500/10 to-transparent px-4 py-2.5">
      <p className="text-xs sm:text-sm text-sky-100 inline-flex items-center gap-2">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-200" />
        جاري تحديث بيانات الفرع...
      </p>
    </div>
  );
}

export { DashboardRefreshBanner };
