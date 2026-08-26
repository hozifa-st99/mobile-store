"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  canAccessPathname,
  hasScreenAccess,
  isSuperAdminRole,
  pathnameToScreenKey,
  type ScreenKey,
} from "@/lib/permissions";

export function useScreenAccess() {
  const user = useAuthStore((s) => s.user);
  const allowedScreens = useAuthStore((s) => s.allowedScreens);

  const role = user?.role ?? "";
  const isSuperAdmin = isSuperAdminRole(role);

  const canAccessScreen = useCallback(
    (screenKey: ScreenKey) => hasScreenAccess(role, allowedScreens, screenKey),
    [role, allowedScreens]
  );

  const canAccessPath = useCallback(
    (pathname: string) => canAccessPathname(role, allowedScreens, pathname),
    [role, allowedScreens]
  );

  return {
    role,
    isSuperAdmin,
    allowedScreens,
    canAccessScreen,
    canAccessPath,
    pathnameToScreenKey,
  };
}
