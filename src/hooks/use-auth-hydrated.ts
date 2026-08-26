"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

/** ينتظر تحميل بيانات تسجيل الدخول من localStorage قبل إظهار null */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
