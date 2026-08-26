"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDefaultBranchLandingPath } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";

export default function BranchesPage() {
  const router = useRouter();
  const { user, branches, isAuthenticated, setBranch, allowedScreens } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    } else {
      setReady(true);
    }
  }, [isAuthenticated, router]);

  const handleSelectBranch = async (branchId: string) => {
    setLoading(branchId);
    try {
      const res = await fetch("/api/auth/select-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "حدث خطأ");
        return;
      }

      const branch = branches.find((b) => b.id === branchId);
      if (branch) setBranch(branch);
      router.push(getDefaultBranchLandingPath(user?.role ?? "", allowedScreens));
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="branches-glass-panel animate-slide-up">
      <div className="branches-header">
        <div className="branches-header__badge">
          <span>🏢</span>
          <span>اختيار الفرع</span>
        </div>
        <h1 className="branches-header__title">
          مرحبًا، <span>{user?.fullName}</span>
        </h1>
        <p className="branches-header__subtitle">اختر الفرع للمتابعة إلى لوحة التحكم</p>
      </div>

      <div className="space-y-3 sm:space-y-3.5">
        {branches.map((branch, index) => (
          <div
            key={branch.id}
            onClick={() => !loading && handleSelectBranch(branch.id)}
            className="branch-card branches-card-enter flex items-center gap-3 sm:gap-4 md:gap-5 group"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <div className="branch-icon">
              <span className="branch-icon__emoji" title="فرع">
                🏢
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-primary-light transition-colors">
                {branch.name}
              </h3>
              {branch.address && (
                <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-1">
                  <span
                    className="w-3.5 h-3.5 flex-shrink-0 inline-flex items-center justify-center text-lg leading-none"
                    title="العنوان"
                  >
                    📍
                  </span>
                  <span className="truncate">{branch.address}</span>
                </p>
              )}
              {branch.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-3.5 h-3.5 inline-flex items-center justify-center text-lg leading-none"
                    title="الهاتف"
                  >
                    📞
                  </span>
                  {branch.phone}
                </p>
              )}
            </div>

            <div className="flex-shrink-0">
              {loading === branch.id ? (
                <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin block" />
              ) : (
                <span
                  className="w-6 h-6 text-gray-500 group-hover:text-primary group-hover:translate-x-[-3px] transition-all inline-flex items-center justify-center text-lg leading-none"
                  title="دخول"
                >
                  ◀️
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
