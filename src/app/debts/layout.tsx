"use client";

import HubSidebar from "@/components/layout/HubSidebar";

export default function DebtsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="orb-glow-1" aria-hidden />
      <div className="orb-glow-2" aria-hidden />
      <div className="hub-rail-shell relative z-10">
        <HubSidebar />
        <div className="hub-rail-main p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
