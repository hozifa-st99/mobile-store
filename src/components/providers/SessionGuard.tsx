"use client";

import { useEffect, useRef, useState } from "react";

import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";

/** يتحقق أن الكوكيز ما زالت صالحة بعد تحميل localStorage (مهم بعد db:reset-fresh). */
export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const validatedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hydrated) return;

    if (!isAuthenticated) {
      validatedRef.current = false;
      return;
    }

    if (validatedRef.current) return;
    validatedRef.current = true;

    fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) return;
        logout();
        toast.error("انتهت الجلسة — سجّل الدخول مجدداً");
        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      })
      .catch(() => {
        logout();
        toast.error("انتهت الجلسة — سجّل الدخول مجدداً");
        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      });
  }, [mounted, hydrated, isAuthenticated, logout]);

  return <>{children}</>;
}
