"use client";

import Link from "next/link";

import { useScreenAccess } from "@/hooks/use-screen-access";

export default function DashboardHomeButton() {
  const { canAccessScreen } = useScreenAccess();
  if (!canAccessScreen("dashboard")) return null;

  return (
    <Link
      href="/dashboard"
      className="dashboard-home-btn group flex-shrink-0"
      title="القائمة الرئيسية"
      aria-label="القائمة الرئيسية"
    >
      <span className="dashboard-home-btn-icon" aria-hidden>
        🏠
      </span>
      <span className="dashboard-home-btn-ring" aria-hidden />
    </Link>
  );
}
