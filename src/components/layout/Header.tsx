"use client";

import { Bell, Search, Settings } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { ROLE_LABELS } from "@/lib/auth";
import { MobileMenuButton } from "@/components/layout/Sidebar";
import { useMobileMenu } from "@/components/layout/mobile-menu-context";
import DashboardQuickBar from "@/components/dashboard/DashboardQuickBar";

export default function Header() {
  const { user } = useAuthStore();
  const { openMenu } = useMobileMenu();

  return (
    <header className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MobileMenuButton onClick={openMenu} />
          <div className="min-w-0">
            <h1 className="page-title flex items-center gap-2 truncate">
              مرحبًا، {user?.fullName} 👋
            </h1>
            <p className="page-subtitle hidden sm:block">
              إدارة مبيعاتك بسهولة واحترافية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-background-card border border-border flex items-center justify-center text-muted hover:text-white hover:border-primary/30 transition-all">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              3
            </span>
          </button>

          <button className="hidden sm:flex w-10 h-10 rounded-xl bg-background-card border border-border items-center justify-center text-muted hover:text-white hover:border-primary/30 transition-all">
            <Settings className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-border">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-glow-sm">
              {user?.fullName?.charAt(0) || "م"}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-white">{user?.fullName}</p>
              <p className="text-xs font-normal text-muted">
                {ROLE_LABELS[user?.role || ""] || user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DashboardQuickBar />

      <div className="relative w-full">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
        <input
          type="text"
          placeholder="ابحث عن منتج، عميل، فاتورة..."
          className="w-full bg-background-card border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm font-medium text-white placeholder:text-muted-dark placeholder:font-normal focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>
    </header>
  );
}
