"use client";

import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import { DashboardProvider, useDashboard } from "@/components/dashboard/DashboardProvider";
import DashboardLoadingShell, {
  DashboardRefreshBanner,
} from "@/components/dashboard/DashboardLoadingShell";
import KpiRow from "@/components/dashboard/KpiRow";

const TopProducts = dynamic(() => import("@/components/dashboard/TopProducts"), {
  loading: () => <div className="glass-card p-5 mb-6 h-40 animate-pulse rounded-2xl" />,
});

const RecentInvoices = dynamic(() => import("@/components/dashboard/RecentInvoices"), {
  loading: () => <div className="glass-card p-5 h-64 animate-pulse rounded-2xl" />,
});

const QuickActions = dynamic(() => import("@/components/dashboard/QuickActions"), {
  loading: () => <div className="glass-card p-5 h-72 animate-pulse rounded-2xl" />,
});

const DashboardAlerts = dynamic(() => import("@/components/dashboard/DashboardAlerts"), {
  loading: () => <div className="glass-card p-5 h-72 animate-pulse rounded-2xl" />,
});

const SalesChart = dynamic(() => import("@/components/dashboard/SalesChart"), {
  ssr: false,
  loading: () => <div className="glass-card p-5 h-72 animate-pulse rounded-2xl" />,
});

const OpenShiftHourlyChart = dynamic(
  () => import("@/components/dashboard/OpenShiftHourlyChart"),
  {
    ssr: false,
    loading: () => <div className="glass-card p-5 h-72 animate-pulse rounded-2xl" />,
  }
);

function DashboardPageBody() {
  const { loading, hasWarmCache } = useDashboard();

  return (
    <>
      <Header />
      {loading && !hasWarmCache ? (
        <DashboardLoadingShell />
      ) : (
        <>
          {loading && hasWarmCache ? <DashboardRefreshBanner /> : null}
          <KpiRow />
          <TopProducts />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <RecentInvoices />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>

          <div className="mt-5">
            <OpenShiftHourlyChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
            <div className="lg:col-span-2">
              <SalesChart />
            </div>
            <div>
              <DashboardAlerts />
            </div>
          </div>
        </>
      )}

      <footer className="flex items-center justify-between mt-8 pt-4 border-t border-border text-xs text-muted-dark">
        <span>© 2024 Mobile Store. جميع الحقوق محفوظة.</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-green" />
            متصل
          </span>
          <span>v 2.1.0</span>
        </div>
      </footer>
    </>
  );
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardPageBody />
    </DashboardProvider>
  );
}
