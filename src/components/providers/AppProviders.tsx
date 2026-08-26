"use client";

import ToastProvider from "@/components/ui/ToastProvider";
import PendingOperationLeaveGuard from "@/components/providers/PendingOperationLeaveGuard";
import SessionGuard from "@/components/providers/SessionGuard";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      {children}
      <PendingOperationLeaveGuard />
      <ToastProvider />
    </SessionGuard>
  );
}
