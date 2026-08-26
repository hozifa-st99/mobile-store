"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useMobileMenu } from "@/components/layout/mobile-menu-context";
import { MobileMenuButton } from "@/components/layout/Sidebar";
import DashboardHomeButton from "@/components/layout/DashboardHomeButton";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  action?: { label: string; href: string };
  extraAction?: ReactNode;
  /** يظهر قبل زر القائمة الرئيسية — في نفس صف العنوان */
  centerAction?: ReactNode;
  showHomeButton?: boolean;
  /** شاشات الـ hub (ديون، فروع) — بدون زر قائمة الفرع */
  hideMobileMenu?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  action,
  extraAction,
  centerAction,
  showHomeButton = false,
  hideMobileMenu = false,
}: PageHeaderProps) {
  const { openMenu } = useMobileMenu();
  const hasTopActions = Boolean(centerAction || showHomeButton);
  const hasBottomActions = Boolean(extraAction || action);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {!hideMobileMenu ? <MobileMenuButton onClick={openMenu} /> : null}
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {hasTopActions ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            {centerAction}
            {showHomeButton ? <DashboardHomeButton /> : null}
          </div>
        ) : null}
      </div>
      {hasBottomActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {extraAction}
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              {action.label}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
