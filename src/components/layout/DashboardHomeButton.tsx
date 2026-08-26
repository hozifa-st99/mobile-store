"use client";

import Link from "next/link";

export default function DashboardHomeButton() {
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
