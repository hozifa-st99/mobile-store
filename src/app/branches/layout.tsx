"use client";

import HubSidebar from "@/components/layout/HubSidebar";
import BranchesSceneBackground from "@/components/branches/BranchesSceneBackground";

import "@/styles/branches-premium.css";

export default function BranchesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="branches-scene relative overflow-x-hidden">
      <BranchesSceneBackground />
      <div className="hub-rail-shell relative z-10">
        <HubSidebar />
        <div className="hub-rail-main hub-rail-main--center hub-rail-main--branches p-3 sm:p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
