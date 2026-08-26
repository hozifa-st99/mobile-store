"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
        <h2 className="text-lg font-bold text-white">حدث خطأ</h2>
        <p className="text-sm text-muted">{error.message || "تعذر تحميل الصفحة"}</p>
        <button type="button" onClick={() => reset()} className="btn-primary w-full">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
