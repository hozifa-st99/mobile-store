"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased min-h-screen flex items-center justify-center p-6 bg-[#0a0a0f] text-white">
        <div className="max-w-md w-full text-center space-y-4 rounded-xl border border-white/10 p-8">
          <h2 className="text-lg font-bold">خطأ في التطبيق</h2>
          <p className="text-sm text-white/60">{error.message || "تعذر تحميل التطبيق"}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
