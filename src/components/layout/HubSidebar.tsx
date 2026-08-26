"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import BranchComparisonReportsModal from "@/components/branch-comparison/BranchComparisonReportsModal";
import CatalogAvailabilityModal from "@/components/sales/CatalogAvailabilityModal";
import { em } from "@/components/ui/TableEmoji";
import { useScreenAccess } from "@/hooks/use-screen-access";
import {
  isCompanyHubBranchesPath,
  isCompanyHubBranchComparisonPath,
  isCompanyHubCustomersPath,
  isCompanyHubDebtsPath,
  isCompanyHubSettingsPath,
} from "@/lib/company-hub";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  guardBranchSwitch,
  guardLogout,
  usePendingOperationStore,
} from "@/store/pending-operation-store";

type HubItem = {
  id: string;
  label: string;
  emoji: string;
  href?: string;
  enabled?: boolean;
  variant?: "default" | "danger";
  action?: "logout" | "branches" | "addParty" | "catalogAvailability" | "branchComparison";
};

const TOP_ITEMS: HubItem[] = [
  {
    id: "search",
    label: "استعلام المخزون",
    emoji: em.search,
    enabled: true,
    action: "catalogAvailability",
  },
  {
    id: "branches",
    label: "الفروع",
    emoji: em.branch,
    enabled: true,
    action: "branches",
  },
  { id: "debts", label: "الديون والأجل", emoji: em.payment, href: "/debts", enabled: true },
  { id: "addParty", label: "إضافة عميل أو مورد", emoji: "➕", enabled: true, action: "addParty" },
  { id: "reports", label: "التقارير", emoji: em.report, enabled: true, action: "branchComparison" },
  {
    id: "settings",
    label: "الضبط",
    emoji: em.settings,
    href: "/dashboard/settings",
    enabled: true,
  },
];

function HubIconButton({
  item,
  active,
  onLogout,
  onBranches,
  onAddParty,
  onCatalogAvailability,
  onBranchComparison,
  pendingOperationBlocked = false,
}: {
  item: HubItem;
  active: boolean;
  onLogout: () => void;
  onBranches: () => void;
  onAddParty: () => void;
  onCatalogAvailability: () => void;
  onBranchComparison: () => void;
  pendingOperationBlocked?: boolean;
}) {
  const className = cn(
    "hub-rail-icon group",
    active && "hub-rail-icon--active",
    item.variant === "danger" && "hub-rail-icon--danger",
    !item.enabled && "hub-rail-icon--disabled"
  );

  const iconEl = (
    <span
      className={cn(
        "hub-rail-emoji",
        active && "hub-rail-emoji--active",
        !item.enabled && "hub-rail-emoji--muted"
      )}
      aria-hidden
    >
      {item.emoji}
    </span>
  );

  if (item.action === "logout") {
    const title = pendingOperationBlocked ? "في عملية جارية — استنى لحد ما تخلص" : item.label;
    return (
      <button
        type="button"
        onClick={onLogout}
        disabled={pendingOperationBlocked}
        className={cn(className, pendingOperationBlocked && "opacity-45 cursor-not-allowed")}
        aria-label={item.label}
        title={title}
      >
        {iconEl}
      </button>
    );
  }

  if (item.action === "branches") {
    const title = pendingOperationBlocked ? "في عملية جارية — استنى لحد ما تخلص" : item.label;
    return (
      <button
        type="button"
        onClick={onBranches}
        disabled={pendingOperationBlocked}
        className={cn(className, pendingOperationBlocked && "opacity-45 cursor-not-allowed")}
        aria-label={item.label}
        title={title}
      >
        {iconEl}
      </button>
    );
  }

  if (item.action === "addParty") {
    return (
      <button
        type="button"
        onClick={onAddParty}
        className={className}
        aria-label={item.label}
        title={item.label}
      >
        {iconEl}
      </button>
    );
  }

  if (item.action === "catalogAvailability") {
    return (
      <button
        type="button"
        onClick={onCatalogAvailability}
        className={className}
        aria-label={item.label}
        title={item.label}
      >
        {iconEl}
      </button>
    );
  }

  if (item.action === "branchComparison") {
    return (
      <button
        type="button"
        onClick={onBranchComparison}
        className={className}
        aria-label={item.label}
        title={item.label}
      >
        {iconEl}
      </button>
    );
  }

  if (item.href && item.enabled) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-label={item.label}
        title={item.label}
      >
        {iconEl}
      </Link>
    );
  }

  return (
    <span className={className} aria-label={item.label} title={`${item.label} — قريبًا`}>
      {iconEl}
    </span>
  );
}

export default function HubSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const branches = useAuthStore((s) => s.branches);
  const selectedBranch = useAuthStore((s) => s.selectedBranch);
  const { canAccessPath } = useScreenAccess();
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [catalogAvailabilityOpen, setCatalogAvailabilityOpen] = useState(false);
  const [branchComparisonOpen, setBranchComparisonOpen] = useState(false);
  const pendingOperationBlocked = usePendingOperationStore((state) => state.count > 0);

  const referenceBranch = useMemo(() => {
    if (selectedBranch) {
      return { id: selectedBranch.id, name: selectedBranch.name };
    }
    const fallback = branches.find((b) => b.isDefault) ?? branches[0];
    return fallback ? { id: fallback.id, name: fallback.name } : null;
  }, [selectedBranch, branches]);

  const settingsActive = isCompanyHubSettingsPath(pathname);
  const branchesActive = isCompanyHubBranchesPath(pathname);
  const debtsActive = isCompanyHubDebtsPath(pathname);
  const customersActive = isCompanyHubCustomersPath(pathname);
  const branchComparisonActive = isCompanyHubBranchComparisonPath(pathname);

  const canAddCustomer = canAccessPath("/dashboard/customers");
  const canAddSupplier = canAccessPath("/dashboard/settings/suppliers");
  const canAccessDebts = canAccessPath("/debts");
  const canAccessReports = canAccessPath("/branch-comparison");

  const topItems = useMemo(
    () =>
      TOP_ITEMS.filter((item) => {
        if (item.id === "addParty") return canAddCustomer || canAddSupplier;
        if (item.id === "debts") return canAccessDebts;
        if (item.id === "reports") return canAccessReports;
        return true;
      }),
    [canAddCustomer, canAddSupplier, canAccessDebts, canAccessReports]
  );

  const handleLogout = () => {
    guardLogout(() => {
      void (async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        logout();
        router.replace("/");
      })();
    });
  };

  const handleBranches = () => {
    guardBranchSwitch(() => {
      useAuthStore.getState().clearSelectedBranch();
      router.push("/branches");
    });
  };

  const handleAddPartyOpen = () => {
    if (!canAddCustomer && !canAddSupplier) return;
    setAddPartyOpen(true);
  };

  const goToAddCustomer = () => {
    setAddPartyOpen(false);
    router.push("/dashboard/customers?new=1");
  };

  const goToAddSupplier = () => {
    setAddPartyOpen(false);
    router.push("/dashboard/settings/suppliers?new=1");
  };

  const logoutItem: HubItem = {
    id: "logout",
    label: "تسجيل الخروج",
    emoji: "🚪",
    enabled: true,
    variant: "danger",
    action: "logout",
  };

  return (
    <>
      <aside className="hub-rail" aria-label="قائمة سريعة">
        <div className="hub-rail__inner">
          <div className="hub-rail__glow" aria-hidden />

          <nav className="hub-rail__nav">
            {topItems.map((item) => (
              <HubIconButton
                key={item.id}
                item={item}
                active={
                  (item.id === "settings" && settingsActive) ||
                  (item.id === "branches" && branchesActive) ||
                  (item.id === "debts" && debtsActive) ||
                  (item.id === "search" && catalogAvailabilityOpen) ||
                  (item.id === "reports" && (branchComparisonOpen || branchComparisonActive)) ||
                  (item.id === "addParty" && (addPartyOpen || customersActive))
                }
                onLogout={handleLogout}
                onBranches={handleBranches}
                onAddParty={handleAddPartyOpen}
                onCatalogAvailability={() => setCatalogAvailabilityOpen(true)}
                onBranchComparison={() => setBranchComparisonOpen(true)}
                pendingOperationBlocked={pendingOperationBlocked}
              />
            ))}
          </nav>

          <div className="hub-rail__bottom">
            <span className="hub-rail__dot" aria-hidden />
            <HubIconButton
              item={logoutItem}
              active={false}
              onLogout={handleLogout}
              onBranches={handleBranches}
              onAddParty={handleAddPartyOpen}
              onCatalogAvailability={() => setCatalogAvailabilityOpen(true)}
              onBranchComparison={() => setBranchComparisonOpen(true)}
            />
          </div>
        </div>
      </aside>

      <Modal open={addPartyOpen} onClose={() => setAddPartyOpen(false)} title="إضافة جديد" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-muted">اختر نوع الإضافة</p>
          {canAddCustomer && (
            <button
              type="button"
              onClick={goToAddCustomer}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/30 transition-all text-right"
            >
              <span className="text-2xl" aria-hidden>
                {em.customers}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">إضافة عميل</p>
                <p className="text-xs text-muted mt-0.5">فتح شاشة العملاء مع نموذج الإضافة</p>
              </div>
            </button>
          )}
          {canAddSupplier && (
            <button
              type="button"
              onClick={goToAddSupplier}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/30 transition-all text-right"
            >
              <span className="text-2xl" aria-hidden>
                {em.supplier}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">إضافة مورد</p>
                <p className="text-xs text-muted mt-0.5">فتح شاشة الموردين مع نموذج الإضافة</p>
              </div>
            </button>
          )}
          <button type="button" onClick={() => setAddPartyOpen(false)} className="btn-secondary w-full mt-2">
            إلغاء
          </button>
        </div>
      </Modal>

      <BranchComparisonReportsModal
        open={branchComparisonOpen}
        onClose={() => setBranchComparisonOpen(false)}
      />

      <CatalogAvailabilityModal
        open={catalogAvailabilityOpen}
        onClose={() => setCatalogAvailabilityOpen(false)}
        referenceBranchId={referenceBranch?.id ?? null}
        referenceHint={
          !selectedBranch && referenceBranch
            ? `لم تختر فرعاً بعد — «متوفر هنا» حسب فرع ${referenceBranch.name} كمرجع.`
            : null
        }
      />
    </>
  );
}
