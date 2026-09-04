"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { LogoDisplay } from "@/components/ui/LogoUpload";
import { useScreenAccess } from "@/hooks/use-screen-access";
import { useAuthStore } from "@/store/auth-store";
import {
  guardBranchSwitch,
  guardLogout,
  usePendingOperationStore,
} from "@/store/pending-operation-store";

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  emoji: string;
  children: NavLink[];
}

type MenuEntry =
  | ({ type: "link" } & NavLink & { emoji: string })
  | ({ type: "group" } & NavGroup);

const menuStructure: MenuEntry[] = [
  { type: "link", href: "/dashboard", label: "الرئيسية", emoji: "🏠" },
  {
    type: "group",
    id: "sales",
    label: "المبيعات",
    emoji: "🛒",
    children: [
      { href: "/dashboard/sales/new", label: "فاتورة مبيعات" },
      { href: "/dashboard/sales/returns", label: "مرتجع مبيعات" },
      { href: "/dashboard/sales", label: "استعراض فواتير المبيعات" },
    ],
  },
  {
    type: "group",
    id: "purchases",
    label: "المشتريات",
    emoji: "🚚",
    children: [
      { href: "/dashboard/purchases/new", label: "فاتورة مشتريات" },
      { href: "/dashboard/purchases/returns", label: "مرتجع مشتريات" },
      { href: "/dashboard/purchases", label: "استعراض فواتير المشتريات" },
      { href: "/dashboard/purchases/debts", label: "الأجل والمديونات" },
    ],
  },
  { type: "link", href: "/dashboard/expenses", label: "المصروفات", emoji: "🧾" },
  { type: "link", href: "/dashboard/products", label: "المنتجات", emoji: "📦" },
  {
    type: "group",
    id: "warehouses",
    label: "المخازن",
    emoji: "🏭",
    children: [
      { href: "/dashboard/inventory", label: "المخزون" },
      { href: "/dashboard/inventory/stocktake", label: "تسوية / جرد" },
      { href: "/dashboard/inventory/imei-tracker", label: "تتبع IMEI" },
    ],
  },
  { type: "link", href: "/dashboard/maintenance", label: "الصيانة", emoji: "🔧" },
  { type: "link", href: "/dashboard/documents", label: "سجل الحركات", emoji: "📋" },
  {
    type: "group",
    id: "accounts",
    label: "الحسابات",
    emoji: "💰",
    children: [
      { href: "/dashboard/treasury", label: "تقفيل الوردية" },
      { href: "/dashboard/treasury/deposits", label: "سجل التوريدات السابقة" },
      { href: "/dashboard/treasury/vault", label: "خزنة الفرع" },
      { href: "/dashboard/reports", label: "التقارير والتحليلات" },
    ],
  },
  {
    type: "group",
    id: "contacts",
    label: "العملاء والموردين",
    emoji: "👥",
    children: [
      { href: "/dashboard/customers", label: "العملاء" },
      { href: "/dashboard/settings/suppliers", label: "الموردين" },
    ],
  },
  {
    type: "group",
    id: "branch_staff",
    label: "موظفي الفرع",
    emoji: "👔",
    children: [
      { href: "/dashboard/branch-employees", label: "الموظفين" },
      { href: "/dashboard/branch-employees/report", label: "تقرير الموظفين" },
    ],
  },
  { type: "link", href: "/dashboard/settings", label: "الإعدادات", emoji: "⚙️" },
];

function filterMenuStructure(
  items: MenuEntry[],
  canAccessPath: (pathname: string) => boolean
): MenuEntry[] {
  return items
    .map((item) => {
      if (item.type === "link") {
        return canAccessPath(item.href) ? item : null;
      }
      const children = item.children.filter((child) => canAccessPath(child.href));
      if (children.length === 0) return null;
      return { ...item, children };
    })
    .filter(Boolean) as MenuEntry[];
}

function getActiveGroupIdFromMenu(items: MenuEntry[], path: string): string | null {
  for (const item of items) {
    if (item.type === "group" && groupHasActiveChild(item.children, path)) {
      return item.id;
    }
  }
  return null;
}

function isListViewPath(href: string, pathname: string): boolean {
  if (href === "/dashboard/sales") {
    return (
      pathname === href ||
      (pathname.startsWith("/dashboard/sales/") &&
        !pathname.startsWith("/dashboard/sales/new") &&
        !pathname.startsWith("/dashboard/sales/returns"))
    );
  }
  if (href === "/dashboard/purchases") {
    return (
      pathname === href ||
      (pathname.startsWith("/dashboard/purchases/") &&
        !pathname.startsWith("/dashboard/purchases/new") &&
        !pathname.startsWith("/dashboard/purchases/returns") &&
        !pathname.startsWith("/dashboard/purchases/debts"))
    );
  }
  if (href === "/dashboard/treasury") {
    return pathname === href;
  }
  if (href === "/dashboard/settings") {
    return (
      pathname === href ||
      (pathname.startsWith("/dashboard/settings/") &&
        !pathname.startsWith("/dashboard/settings/suppliers"))
    );
  }
  if (href === "/dashboard/branch-employees") {
    return pathname === href;
  }
  if (href === "/dashboard/branch-employees/report") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/dashboard/inventory") {
    return pathname === href;
  }
  if (href === "/dashboard/inventory/stocktake") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/dashboard/inventory/imei-tracker") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLinkActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return isListViewPath(href, pathname);
}

function getActiveGroupId(path: string, items: MenuEntry[]): string | null {
  return getActiveGroupIdFromMenu(items, path);
}

function groupHasActiveChild(children: NavLink[], pathname: string): boolean {
  return children.some((child) => isLinkActive(child.href, pathname));
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, selectedBranch, branches, logout, companyLogoUrl, updateCompanyLogoUrl } =
    useAuthStore();
  const canSwitchBranch = branches.length > 1;
  const pendingOperationBlocked = usePendingOperationStore((state) => state.count > 0);
  const { canAccessPath } = useScreenAccess();
  const visibleMenu = useMemo(
    () => filterMenuStructure(menuStructure, canAccessPath),
    [canAccessPath]
  );

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const id = getActiveGroupId(pathname, visibleMenu);
    return id ? new Set([id]) : new Set();
  });

  useEffect(() => {
    const id = getActiveGroupId(pathname, visibleMenu);
    setOpenGroups((prev) => {
      if (id) {
        if (prev.size === 1 && prev.has(id)) return prev;
        return new Set([id]);
      }
      if (prev.size === 0) return prev;
      return new Set();
    });
  }, [pathname, visibleMenu]);

  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  useEffect(() => {
    fetch("/api/settings/company", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.company) {
          updateCompanyLogoUrl(data.company.logoUrl ?? null);
        }
      })
      .catch(() => {
        /* keep cached logo */
      });
  }, [updateCompanyLogoUrl]);

  const companyName = user?.companyName || "MOBILE STORE";

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const handleLogout = () => {
    guardLogout(() => {
      void (async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        logout();
        router.replace("/");
      })();
    });
  };

  const handleSwitchBranch = () => {
    guardBranchSwitch(() => {
      useAuthStore.getState().clearSelectedBranch();
      onMobileClose();
      router.replace("/branches");
    });
  };

  const sidebarContent = (
    <>
      <div className="glass-sidebar__header p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <LogoDisplay
              url={companyLogoUrl}
              name={companyName}
              size="sm"
              className="rounded-xl ring-1 ring-white/20 shadow-glow-sm shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-bold text-white text-sm tracking-wide truncate">{companyName}</h2>
              <p className="text-[11px] font-normal text-muted-dark">الاختيار الذكي</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="X">
              ❌
            </span>
          </button>
        </div>
        {selectedBranch && (
          <p className="text-xs text-primary-light mt-2.5 truncate font-normal">
            📍 {selectedBranch.name}
          </p>
        )}
      </div>

      <nav className="glass-sidebar__nav flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleMenu.map((item) => {
          if (item.type === "link") {
            const isActive = isLinkActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(isActive ? "sidebar-item-active" : "sidebar-item")}
              >
                <span
                  className={cn(
                    "text-xl w-5 h-5 flex items-center justify-center",
                    isActive ? "" : "opacity-80 grayscale"
                  )}
                  style={isActive ? {} : { filter: "grayscale(100%) opacity(0.8)" }}
                >
                  {item.emoji}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          }

          const isOpen = openGroups.has(item.id);
          const groupActive = groupHasActiveChild(item.children, pathname);

          return (
            <div key={item.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(item.id)}
                className={cn(
                  groupActive ? "sidebar-item-active" : "sidebar-item",
                  "w-full justify-between"
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xl w-5 h-5 flex items-center justify-center",
                      groupActive ? "" : "opacity-80 grayscale"
                    )}
                    style={groupActive ? {} : { filter: "grayscale(100%) opacity(0.8)" }}
                  >
                    {item.emoji}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </span>
                <span
                  className={cn(
                    "text-xs text-muted transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                >
                  ▾
                </span>
              </button>

              {isOpen && (
                <div className="mr-3 pr-3 border-r border-white/10 space-y-0.5">
                  {item.children.map((child) => {
                    const isActive = isLinkActive(child.href, pathname);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200",
                          isActive
                            ? "bg-primary/20 text-white font-semibold border border-primary/30"
                            : "text-muted hover:text-white hover:bg-white/5"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="glass-sidebar__footer p-3 space-y-1">
        {canSwitchBranch && (
          <button
            type="button"
            onClick={handleSwitchBranch}
            disabled={pendingOperationBlocked}
            title={pendingOperationBlocked ? "في عملية جارية — استنى لحد ما تخلص" : undefined}
            className={cn(
              "sidebar-item w-full text-primary-light/90 hover:text-primary-light hover:bg-primary/10",
              pendingOperationBlocked && "opacity-45 cursor-not-allowed hover:bg-transparent"
            )}
          >
            <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="Branches">
              🏢
            </span>
            <span className="text-sm">تغيير الفرع</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={pendingOperationBlocked}
          title={pendingOperationBlocked ? "في عملية جارية — استنى لحد ما تخلص" : undefined}
          className={cn(
            "sidebar-item w-full text-red-400/80 hover:text-red-400 hover:bg-red-500/10",
            pendingOperationBlocked && "opacity-45 cursor-not-allowed hover:bg-transparent hover:text-red-400/80"
          )}
        >
          <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="LogOut">
            🚪
          </span>
          <span className="text-sm">تسجيل الخروج</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/45 z-40 lg:hidden backdrop-blur-md"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "glass-sidebar fixed flex flex-col z-50 transition-transform duration-300 ease-in-out",
          "top-3 bottom-3 h-[calc(100vh-1.5rem)] w-[272px] max-w-[calc(100vw-1.5rem)] right-3 rounded-[1.5rem]",
          mobileOpen ? "translate-x-0" : "translate-x-[calc(100%+1.5rem)] lg:translate-x-0"
        )}
      >
        <div className="glass-sidebar__inner">{sidebarContent}</div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden w-10 h-10 rounded-xl bg-background-card border border-border flex items-center justify-center text-muted hover:text-white hover:border-primary/30 transition-all flex-shrink-0"
      aria-label="فتح القائمة"
    >
      <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="Menu">
        ☰
      </span>
    </button>
  );
}
