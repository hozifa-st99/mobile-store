"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import HubSidebar from "@/components/layout/HubSidebar";
import Sidebar from "@/components/layout/Sidebar";
import { MobileMenuProvider, useMobileMenu } from "@/components/layout/mobile-menu-context";
import { useAuthHydrated } from "@/hooks/use-auth-hydrated";
import { useScreenAccess } from "@/hooks/use-screen-access";
import { isCompanyHubPath } from "@/lib/company-hub";
import { useAuthStore } from "@/store/auth-store";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthHydrated();
  const { isAuthenticated, selectedBranch } = useAuthStore();
  const { open, closeMenu } = useMobileMenu();
  const { canAccessPath, role, allowedScreens } = useScreenAccess();
  const settingsHubMode = !selectedBranch && isCompanyHubPath(pathname);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.replace("/");
    else if (!selectedBranch && !isCompanyHubPath(pathname)) router.replace("/branches");
  }, [hydrated, isAuthenticated, selectedBranch, pathname, router]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (!selectedBranch && !isCompanyHubPath(pathname)) return;
    if (pathname.startsWith("/dashboard") && !canAccessPath(pathname)) {
      router.replace(settingsHubMode ? "/dashboard/settings" : "/dashboard");
    }
  }, [
    hydrated,
    isAuthenticated,
    selectedBranch,
    pathname,
    role,
    allowedScreens,
    canAccessPath,
    router,
    settingsHubMode,
  ]);
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) closeMenu();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [closeMenu]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (!selectedBranch && !settingsHubMode) return null;

  if (settingsHubMode) {
    return (
      <div className="min-h-screen bg-background relative overflow-x-hidden">
        <div className="orb-glow-1" aria-hidden />
        <div className="orb-glow-2" aria-hidden />
        <div className="hub-rail-shell relative z-10">
          <HubSidebar />
          <main className="hub-rail-main p-4 sm:p-6 min-h-screen max-w-full overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="orb-glow-1" aria-hidden />
      <div className="orb-glow-2" aria-hidden />
      <Sidebar mobileOpen={open} onMobileClose={closeMenu} />
      <main className="relative z-10 lg:mr-[296px] p-4 sm:p-6 min-h-screen max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileMenuProvider>
      <DashboardShell>{children}</DashboardShell>
    </MobileMenuProvider>
  );
}
